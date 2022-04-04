import { ConfirmChannel } from 'amqplib';
import { log } from 'Utils';
import { configureMessageBus } from './config';
import { closeMessageBusConnection, connection } from './connection';
import { MessageBusConfig } from './Const';

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
export const initMessageBus = async (config: MessageBusConfig) => {
  initPromiseResolve(config);
  await _postInitPromise;
};

const channel = connection.createChannel({
  json: true,
  setup: async (channel: ConfirmChannel) => {
    log(
      `Waiting for RabbitMQ to be initialized by invoking initMessageBus() from 'pkg-message-bus'.`
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

export const getChannel = async () => {
  await channel.waitForConnect();
  return channel;
};

const closeMessageBusChannel = async () => {
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