import { IMessage, PublishMessageOptions } from 'Types';
import {
  error,
  log,
  pushToLastPublishedMessages,
  safeJsonStringify,
} from 'Utils';
import { Options } from 'amqplib';
import { DEFAULT_CONFIG, DEFAULT_EXCHANGE_NAME } from './Const';
import { getDefaultChannel } from './channel';

interface DirectMessage<MessageType extends IMessage> {
  queueName: string;
  options?: Options.Publish;
  body: MessageType['body'];
}

export const publishMessage = async <
  MessageType extends IMessage = PublishMessageOptions
>(
  message: PublishMessageOptions & MessageType
) => {
  const channel = await getDefaultChannel();
  const exchangeName =
    message.exchangeName ||
    DEFAULT_CONFIG.exchanges?.[0].name ||
    DEFAULT_EXCHANGE_NAME;

  try {
    log(`-> publishing [${message.key}]`);
    const promise = channel.publish(
      exchangeName,
      message.key,
      message.body, // channel.publish stringifies JSON by default.
      message.options
    );
    pushToLastPublishedMessages(message, promise);
    await promise;
  } catch (e) {
    error(
      `Unable to publish message to exchange "${exchangeName}" with routing routingKey "${
        message.key
      }": ${e} | Message: ${safeJsonStringify(message.body)}`
    );
    throw new Error(
      `Message bus encountered an error when publishing to exchange "${exchangeName}" with routingKey "${message.key}".`
    );
  }
};

export const publishMessageToQueue = async <
  DataType extends IMessage = PublishMessageOptions
>({
  body,
  queueName,
  options,
}: DirectMessage<DataType>) => {
  const channel = await getDefaultChannel();

  try {
    log(`Publishing message to queue=${queueName}`);
    await channel.sendToQueue(queueName, body, options);
  } catch (e) {
    error(
      `Unable to publish data ${body} to queue "${queueName}" with options "${JSON.stringify(
        options || {}
      )}": ${e}`
    );
    throw new Error(
      `Message bus encountered an error when publishing a message to queue "${queueName}".`
    );
  }
};
