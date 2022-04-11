import { ConsumeMessageFields, MessageProperties } from 'amqplib';
import { error, info, log } from 'Utils';
import { getChannel } from './channel';
import { getMessageBusConfig } from './config';
import { DEFAULT_EXCHANGE_NAME } from './Const';

const EXP_BACKOFF_HEADER_NAME = 'x-backoff-sec';
const EXP_BACKOFF_MULTIPLIER = 4;
const MAX_EXP_BACKOFF = 1000 * 1024;

interface HandlerExtraParams extends MessageProperties, ConsumeMessageFields {}

export const consumeMessages = async <DataType = any>({
  queueName,
  handler,
}: {
  queueName: string;
  handler: (arg: HandlerExtraParams & { data: DataType }) => any;
}) => {
  const channel = await getChannel();
  const queue = getMessageBusConfig().queues.find((q) => q.name === queueName);
  const consumerTag = `${
    process.env.HOSTNAME || 'no.env.HOSTNAME'
  }-${Math.random().toString(36).slice(2)}`;

  if (!queue) {
    throw new Error(
      `onQueueMessage: provided queue name "${queueName}" is not present in the initial config, which includes the following queue names: ${getMessageBusConfig().queues?.map(
        (q) => q.name
      )}.`
    );
  }

  await channel.consume(
    queueName,
    async (message) => {
      if (message === null) {
        info(`Consumer ${consumerTag} was canceled.`);
        return;
      }

      let data = message.content;
      try {
        data = JSON.parse(message.content.toString());
      } catch (e) {
        log(
          `Unable to parse JSON from the message queue: ${data}. Returning original data.`
        );
      }

      try {
        log(
          `Consuming message from queue=${queueName}, routingKey=${message.fields.routingKey}`
        );
        await handler({
          ...message.properties,
          ...message.fields,
          data: data as unknown as DataType,
        });
        channel.ack(message);
      } catch (e: any) {
        const currentBackoffSeconds =
          parseInt(message.properties.headers[EXP_BACKOFF_HEADER_NAME]) || 0;
        const nextBackoffSeconds = Math.min(
          MAX_EXP_BACKOFF,
          currentBackoffSeconds
            ? currentBackoffSeconds * EXP_BACKOFF_MULTIPLIER
            : 1000
        );
        const backoffQueueName = `${queue.name}.backoff-${Math.floor(
          nextBackoffSeconds / 1000
        )}s+${message.fields.routingKey}`;

        error(
          `Error when consuming message from queue "${queueName}". The message will be requeued to "${backoffQueueName}". Message: ${message.content.toString()}. ${
            e.stack
          }`
        );

        try {
          log(
            `Asserting backoff queue for routing key "${message.fields.routingKey}"`
          );
          await channel.assertQueue(backoffQueueName, {
            ...queue.options,
            messageTtl: nextBackoffSeconds,
            deadLetterExchange:
              queue.options?.deadLetterExchange || DEFAULT_EXCHANGE_NAME,
            deadLetterRoutingKey: message.fields.routingKey,
          });
        } catch (e) {
          error(
            `Failed to assert queue "${
              queue.name
            }" with options ${JSON.stringify(queue.options)}: ${e}`
          );
          await channel.nack(message);
          return;
        }

        try {
          await channel.sendToQueue(backoffQueueName, data, {
            headers: {
              ...message.properties.headers,
              [EXP_BACKOFF_HEADER_NAME]: nextBackoffSeconds,
            },
          });
        } catch (e) {
          error(
            `Failed to send message to the queue "${backoffQueueName}": ${e}`
          );
          await channel.nack(message);
          return;
        }

        await channel.ack(message);
      }
    },
    {
      consumerTag,
    }
  );
  log(`Registered a new consumer for queue=${queueName}`);
};

export const messageBusStopAllConsumers = async () => {
  const channel = await getChannel();
  await channel.cancelAll();
};
