export const NODE_ENV = process.env.NODE_ENV || 'production';
export const NODE_MESSAGE_BUS_CONNECTION_URL =
  process.env.NODE_MESSAGE_BUS_CONNECTION_URL || '';
export const NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_NAME =
  process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_NAME || '';
export const NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE =
  process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE || 'direct';
export const NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY =
  process.env.NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY || '';
export const NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_INSTANCE_LIFETIME =
  +(process.env.NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_INSTANCE_LIFETIME || '') ||
  1000 * 60 * 60;

export const isTestEnv = () => !!NODE_ENV.includes('test');
export const isUsingCloudAmqp = () =>
  !!(
    process.env.NODE_ENV !== 'production' &&
    NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY
  );
