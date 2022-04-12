import { Options } from 'amqplib';
import { LogType } from './logger';

export type ExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';

export interface ExchangeConfig {
  name: string;
  type: ExchangeType;
  options?: Options.AssertExchange;
}

export interface QueueConfig {
  name: string;
  options?: Omit<Options.AssertQueue, 'deadLetterRoutingKey'> & {
    deadLetterRoutingKey: string;
  };
}

export interface BindingConfig {
  fromExchange?: string;
  toQueue: string;
  routingKey: `${string}.*` | `${string}.#` | string;
}

export interface MessageBusConfig {
  logger?: (logType: LogType, message: string) => unknown;
  exchanges?: ExchangeConfig[];
  queues?: QueueConfig[];
  bindings?: BindingConfig[];
}
