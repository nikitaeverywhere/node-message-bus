import { ConfirmChannel } from 'amqplib';
import { MessageBusConfig } from 'Types';
import { error, log } from 'Utils';
import { configureMessageBus, configureMessageBusStatic } from './config';
import { closeMessageBusConnection, getConnection } from './connection';

let initPromiseResolve = (value: MessageBusConfig) => {
  value;
};
// Assign a dummy function which will be reassigned immediately later.
export const _initPromise = new Promise<MessageBusConfig>(
  (r) => (initPromiseResolve = r)
);
let postInitPromiseResolve = (_: any) => {};
const _postInitPromise = new Promise<MessageBusConfig>(
  (r) => (postInitPromiseResolve = r)
);

/** Initialize the message bus. */
export const initMessageBus = async (config: MessageBusConfig = {}) => {
  // Pass only properties that need to be configured BEFORE RabbitMQ connection is established.
  await configureMessageBusStatic({
    logger: config.logger,
  });

  initPromiseResolve(config);
  await _postInitPromise;
};

const channelPromise = getConnection()
  .then((connection) => {
    return connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        log(
          `Waiting for RabbitMQ to be initialized by invoking initMessageBus() from 'node-message-bus'.`
        );
        const config = await _initPromise;

        await configureMessageBus(config, channel);

        log(
          `RabbitMQ initialization is complete with the following config: ${JSON.stringify(
            config
          )}`
        );

        postInitPromiseResolve(true);
      },
    });
  })
  .catch((e) => {
    error(e.stack || e);
    throw e;
  });

export const getChannel = async () => {
  const channel = await channelPromise;
  await channel.waitForConnect();
  return channel;
};

const closeMessageBusChannel = async () => {
  const channel = await channelPromise;
  log(`Cancelling all listening queues...`);
  await channel.cancelAll();
  log(`Closing message bus default channel. Cooling down for 3 seconds...`);
  await new Promise((r) => setTimeout(r, 3000)); // await above is not enough, need to wait.
  await channel.close();
  log(`Message bus default channel is closed.`);
};

export const closeMessageBus = async () => {
  await closeMessageBusChannel();
  await closeMessageBusConnection();
};
