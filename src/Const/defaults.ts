import { ExchangeType, MessageBusConfig } from 'Types';

export const EXCHANGE_TYPES: ExchangeType[] = [
  'direct',
  'topic',
  'fanout',
  'headers',
];

export const DEFAULT_EXCHANGE_NAME =
  process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_NAME || 'amq.topic';
export const DEFAULT_EXCHANGE_TYPE = EXCHANGE_TYPES.find(
  (t) => t === (process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE || 'topic')
) as ExchangeType | undefined;

if (!DEFAULT_EXCHANGE_TYPE) {
  throw new Error(
    `Wrong default exchange type "${process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE}"`
  );
}

export const DEFAULT_CONFIG: MessageBusConfig = {
  exchanges: [
    {
      name: DEFAULT_EXCHANGE_NAME,
      type: DEFAULT_EXCHANGE_TYPE,
    },
  ].filter(({ name }) => name !== ''), // Filter out the default exchange config as it's non-editable.
};
