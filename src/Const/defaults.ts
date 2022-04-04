import { Options } from 'amqplib';

type ExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';

export interface MessageBusConfig {
  exchanges?: {
    name: string;
    type: ExchangeType;
    options?: Options.AssertExchange;
  }[];
  queues?: {
    name: string;
    options?: Omit<Options.AssertQueue, 'deadLetterRoutingKey'> & {
      deadLetterRoutingKey: string;
    };
  }[];
  bindings?: {
    fromExchange?: string;
    toQueue: string;
    routingKey: `${string}.*` | `${string}.#` | string;
  }[];
}

export const DEFAULT_EXCHANGE_NAME =
  process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_NAME || '';
export const DEFAULT_EXCHANGE_TYPE = [
  'direct',
  'topic',
  'fanout',
  'headers',
].find(
  (t) => t === (process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE || 'direct')
) as ExchangeType | undefined;

if (!DEFAULT_EXCHANGE_TYPE) {
  throw new Error(
    `node-message-bus: wrong default exchange type "${process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE}"`
  );
}

export const DEFAULT_CONFIG: MessageBusConfig = {
  exchanges: [
    {
      name: DEFAULT_EXCHANGE_NAME,
      type: DEFAULT_EXCHANGE_TYPE,
    },
  ],
};
