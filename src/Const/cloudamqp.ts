export const CLOUD_AMQP_URL_API = 'https://api.cloudamqp.com/api';
export const CLOUD_AMQP_URL_CUSTOMER_API = 'https://customer.cloudamqp.com/api';

export const CLOUD_AMQP_URL_REGIONS = `${CLOUD_AMQP_URL_CUSTOMER_API}/regions`;
export const CLOUD_AMQP_URL_INSTANCES = `${CLOUD_AMQP_URL_CUSTOMER_API}/instances`;
export const CLOUD_AMQP_URL_INSTANCE = (id: string) =>
  `${CLOUD_AMQP_URL_INSTANCES}/${encodeURIComponent(id)}`;

export const CLOUD_AMQP_INSTANCE_NAME_PREFIX =
  'tests-node-message-bus-delete-after-';
export const CLOUD_AMQP_INSTANCE_TAG = 'tests-node-message-bus';
