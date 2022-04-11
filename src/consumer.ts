import { ChannelWrapper } from 'amqp-connection-manager';
import {
  ConsumeMessage,
  ConsumeMessageFields,
  MessageProperties,
} from 'amqplib';
import { IMessage, QueueConfig } from 'Types';
import { error as logError, info, log } from 'Utils';
import { getChannel } from './channel';
import { getMessageBusConfig } from './config';
import { DEFAULT_EXCHANGE_NAME } from './Const';

const EXP_BACKOFF_HEADER_NAME = 'x-backoff-sec';
const EXP_BACKOFF_MULTIPLIER = 4;
const MAX_EXP_BACKOFF = 1000 * 1024;

interface HandlerExtraParams extends MessageProperties, ConsumeMessageFields {
  failThisMessage: (error?: Error) => Promise<void>;
}

const backoffRetryMessage = async <DataType = any>({
  message,
  queue,
  channel,
  data,
  error,
}: {
  message: ConsumeMessage;
  queue: QueueConfig;
  channel: ChannelWrapper;
  data: DataType;
  error?: Error;
}) => {
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

  if (error) {
    logError(
      `Error when consuming message from queue "${queue.name}". The message will be requeued to "${backoffQueueName}". Routing key: ${message.fields.routingKey}. ${error.stack}`
    );
  } else {
    log(
      `Message from queue "${queue.name}" was canceled. The message will be requeued to "${backoffQueueName}". Routing key: ${message.fields.routingKey}`
    );
  }

  try {
    log(
      `Asserting backoff queue for routing key "${message.fields.routingKey}".`
    );
    await channel.assertQueue(backoffQueueName, {
      ...queue.options,
      messageTtl: nextBackoffSeconds,
      deadLetterExchange:
        queue.options?.deadLetterExchange || DEFAULT_EXCHANGE_NAME,
      deadLetterRoutingKey: message.fields.routingKey,
    });
  } catch (e) {
    logError(
      `Failed to assert queue "${queue.name}" with options ${JSON.stringify(
        queue.options
      )}: ${e}`
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
    logError(`Failed to send message to the queue "${backoffQueueName}": ${e}`);
    await channel.nack(message);
    return;
  }

  await channel.ack(message);
};

export const consumeMessages = async <DataTypeOverrides extends IMessage>({
  queueName,
  handler,
}: {
  queueName: string;
  handler: (arg: HandlerExtraParams & DataTypeOverrides) => any;
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

      let messageBackoff = false;
      const failThisMessage = async (e?: Error) => {
        if (messageBackoff) {
          return;
        }
        messageBackoff = true;
        await backoffRetryMessage({
          message,
          queue,
          channel,
          data,
          error: e,
        });
      };
      const handlerParams: HandlerExtraParams & IMessage = {
        ...message.properties,
        ...message.fields,
        failThisMessage,
        data,
      };

      log(
        `Consuming message from queue=${queueName}, routingKey=${message.fields.routingKey}`
      );
      try {
        await handler(handlerParams as HandlerExtraParams & DataTypeOverrides);

        if (!messageBackoff) {
          channel.ack(message);
        }
      } catch (e: any) {
        await failThisMessage(e);
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
