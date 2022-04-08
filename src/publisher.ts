import { Options } from 'amqplib';
import { error, log } from 'Utils';
import { getChannel } from './channel';
import { DEFAULT_CONFIG, DEFAULT_EXCHANGE_NAME } from './Const';

interface Message {
  routingKey: string;
  body: any;
  exchangeName?: string;
  options?: Options.Publish;
}

interface DirectMessage {
  queueName: string;
  body: any;
  options?: Options.Publish;
}

const LAST_PUBLISHED_MESSAGES_BUFFER_SIZE = 50;

let lastPublishedMessages: any[] = [];
const pushToLastMessages = (m: any) => {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  lastPublishedMessages.push(m);
  if (lastPublishedMessages.length > LAST_PUBLISHED_MESSAGES_BUFFER_SIZE) {
    lastPublishedMessages.splice(0, 1);
  }
};

export const publishMessage = async (message: Message) => {
  const channel = await getChannel();
  const exchangeName =
    message.exchangeName ||
    DEFAULT_CONFIG.exchanges?.[0].name ||
    DEFAULT_EXCHANGE_NAME;

  try {
    log(`Publishing message with routingKey=${message.routingKey}`);
    await channel.publish(
      exchangeName,
      message.routingKey,
      message.body, // channel.publish stringifies JSON by default.
      message.options
    );
    pushToLastMessages(message);
  } catch (e) {
    error(
      `Unable to publish data ${message.body} to exchange "${exchangeName}" with routing routingKey "${message.routingKey}": ${e}`
    );
    throw new Error(
      `Message bus encountered an error when publishing to exchange "${exchangeName}" with routingKey "${message.routingKey}".`
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
