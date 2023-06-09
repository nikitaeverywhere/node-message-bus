import { IMessage } from 'Types';
import { error, log, safeJsonStringify } from 'Utils';
import { Options } from 'amqplib';
import { DEFAULT_CONFIG, DEFAULT_EXCHANGE_NAME, isTestEnv } from './Const';
import { getChannel } from './channel';

interface Message extends IMessage {
  exchangeName?: string;
  options?: Options.Publish;
}

interface DirectMessage extends Omit<IMessage, 'key'> {
  queueName: string;
  options?: Options.Publish;
}

const LAST_PUBLISHED_MESSAGES_BUFFER_SIZE = 50;

let lastPublishedMessages: any[] = [];
const pushToLastMessages = (m: any) => {
  if (!isTestEnv()) {
    return;
  }
  lastPublishedMessages.push(m);
  if (lastPublishedMessages.length > LAST_PUBLISHED_MESSAGES_BUFFER_SIZE) {
    lastPublishedMessages.splice(0, 1);
  }
};

export const publishMessage = async <
  DataType extends { body: any; key: string } = Message
>(
  message: Message & DataType
) => {
  const channel = await getChannel();
  const exchangeName =
    message.exchangeName ||
    DEFAULT_CONFIG.exchanges?.[0].name ||
    DEFAULT_EXCHANGE_NAME;

  try {
    log(`-> publishing [${message.key}]`);
    await channel.publish(
      exchangeName,
      message.key,
      message.body, // channel.publish stringifies JSON by default.
      message.options
    );
    pushToLastMessages(message);
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

/** Use for tests only */
export const getLastPublishedMessages = () => lastPublishedMessages.slice();
/** Use for tests only */
export const resetLastPublishedMessages = () => (lastPublishedMessages = []);

export const publishMessageToQueue = async ({
  body,
  queueName,
  options,
}: DirectMessage) => {
  const channel = await getChannel();

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
