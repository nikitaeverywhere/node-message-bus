import { MessageBusConfig } from 'Types';
import { error, log, setLoggerFunction } from 'Utils';
import {
  AmqpConnectionManagerOptions,
  ChannelWrapper,
} from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import {
  DEFAULT_CONFIG,
  DEFAULT_EXCHANGE_NAME,
  NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY,
} from './Const';

// Config that was applied through the lifetime of the message bus.
const appliedConfig: Required<
  Omit<MessageBusConfig, 'logger' | 'amqpConfig' | 'useCloudAmqpTempInstance'>
> = {
  exchanges: [],
  queues: [],
  bindings: [],
};

let useCloudAmqpTempInstance:
  | MessageBusConfig['useCloudAmqpTempInstance']
  | null = null;
let defaultExchangeConfigured = false;

export let amqpConfig: AmqpConnectionManagerOptions | null = null;

export const isUsingCloudAmqp = () =>
  !!useCloudAmqpTempInstance ||
  !!(
    process.env.NODE_ENV !== 'production' &&
    NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY
  );

export const getCloudAmqpKey = () =>
  useCloudAmqpTempInstance?.apiKey ||
  NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY ||
  '';

/**
 * Returns all applied message bus data through the lifetime of this application.
 */
export const getMessageBusConfig = () => appliedConfig;

/**
 * Configure message bus before it is connected to AMQP.
 */
export const configureMessageBusStatic = async (
  config: Pick<
    MessageBusConfig,
    'amqpConfig' | 'useCloudAmqpTempInstance' | 'logger'
  >
) => {
  if (typeof config.logger === 'function') {
    setLoggerFunction(config.logger);
  }
  if (config.useCloudAmqpTempInstance) {
    useCloudAmqpTempInstance = config.useCloudAmqpTempInstance;
  }
  if (config.amqpConfig) {
    amqpConfig = config.amqpConfig;
  }
};

/**
 * Waits until AMQP is initialized, then configures message bus.
 */
export const configureMessageBus = async (
  config: MessageBusConfig,
  channel?: ChannelWrapper | ConfirmChannel
) => {
  configureMessageBusStatic(config);

  if (!channel) {
    // To avoid creating circular dependency.
    channel = await (await import('./channel')).getChannel();
  }

  const promises: Array<Promise<any>> = [];

  for (const exchange of (config.exchanges || []).concat(
    defaultExchangeConfigured ? [] : DEFAULT_CONFIG.exchanges || []
  )) {
    defaultExchangeConfigured = true;
    try {
      log(`Asserting exchange "${exchange.name}" of type "${exchange.type}".`);
      promises.push(
        channel.assertExchange(exchange.name, exchange.type, exchange.options)
      );
      appliedConfig.exchanges.push(exchange);
    } catch (e) {
      const message = `Failed to assert exchange "${exchange.name}" of type "${
        exchange.type
      }" with options ${JSON.stringify(exchange.options)}: ${e}`;
      error(message);
      throw new Error(message);
    }
  }
  for (const queue of (config.queues || []).concat(
    DEFAULT_CONFIG.queues || []
  )) {
    try {
      log(`Asserting queue "${queue.name}".`);
      promises.push(channel.assertQueue(queue.name, queue.options));
      appliedConfig.queues.push(queue);
    } catch (e) {
      const message = `Failed to assert queue "${
        queue.name
      }" with options ${JSON.stringify(queue.options)}: ${e}`;
      error(message);
      throw new Error(message);
    }
  }
  for (const binding of (config.bindings || []).concat(
    DEFAULT_CONFIG.bindings || []
  )) {
    const fromExchange = binding.fromExchange || DEFAULT_EXCHANGE_NAME;
    try {
      log(
        `Asserting the queue binding "${fromExchange}" -> "${binding.toQueue}" by key "${binding.routingKey}".`
      );
      promises.push(
        channel.bindQueue(binding.toQueue, fromExchange, binding.routingKey)
      );
      appliedConfig.bindings.push(binding);
    } catch (e) {
      const message = `Failed to bind queue "${binding.toQueue}" to exchange "${fromExchange}" via the routing key "${binding.routingKey}": ${e}`;
      error(message);
      throw new Error(message);
    }
  }

  await Promise.all(promises);
};
