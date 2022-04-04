import { Options } from 'amqplib';
import { error, log } from 'Utils';
import { getChannel } from './channel';
import { DEFAULT_CONFIG } from './Const';

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

export const publishMessage = async (x: any) => {
  const channel = await getChannel();
  const exchangeName = DEFAULT_CONFIG.exchanges?.[0].name || 'default';

  try {
    log(`Message bus: publishing message with key=${x.key}`);
    await channel.publish(exchangeName, x.key, x.body); // It stringifies JSON.
    pushToLastMessages(x);
  } catch (e) {
    error(
      `Message bus: unable to publish data ${x.body} to exchange "${exchangeName}" with routing key "${x.key}": ${e}`
    );
    throw new Error(
      `Message bus encountered an error when publishing to exchange "${exchangeName}" with key "${x.key}".`
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
}: {
  body: any;
  queueName: string;
  options?: Options.Publish;
}) => {
  const channel = await getChannel();

  try {
    log(`Message bus: publishing message to queue=${queueName}`);
    await channel.sendToQueue(queueName, body, options);
  } catch (e) {
    error(
      `Message bus: unable to publish data ${body} to queue "${queueName}" with options "${JSON.stringify(
        options || {}
      )}": ${e}`
    );
    throw new Error(
      `Message bus encountered an error when publishing a message to queue "${queueName}".`
    );
  }
};
