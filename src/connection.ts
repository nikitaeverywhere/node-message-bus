import amqp from 'amqp-connection-manager';
import {
  NODE_ENV,
  NODE_MESSAGE_BUS_CONNECTION_URL,
  NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY,
} from 'Const';
import { error, getPrintableConnectionString, log } from 'Utils';
import {
  cleanupOldCloudAmqpInstances,
  deleteCloudAmqpInstance,
  getNewCloudAmqpInstance,
} from './cloudamqp';

type AmqpConnection = ReturnType<typeof amqp.connect>;

let connectionUrl = '';
let cloudAmqpInstanceId = 0;

const usingCloudAMQP =
  NODE_ENV.startsWith('test') && NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY;

log(
  `NODE_ENV=${NODE_ENV}, NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY=${NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY}`
);

const initPromise = (async () => {
  if (usingCloudAMQP) {
    await cleanupOldCloudAmqpInstances();
  }

  connectionUrl = usingCloudAMQP
    ? await (async () => {
        const instance = await getNewCloudAmqpInstance();
        cloudAmqpInstanceId = instance?.id || cloudAmqpInstanceId;
        if (!instance) {
          error(`Unable to create a new CloudAMQP instance!`);
        }
        return instance?.url || `!unable-to-create-a-new-cloud-amqp-instance!`;
      })()
    : NODE_MESSAGE_BUS_CONNECTION_URL || '';
  if (!connectionUrl) {
    throw new Error(
      `FATAL: node-message-bus requires NODE_MESSAGE_BUS_CONNECTION_URL environment variable to be set.`
    );
  }
  const connection = amqp.connect([connectionUrl]);
  connection.on('connect', () => {
    log(
      `Connected to RabbitMQ: ${getPrintableConnectionString(connectionUrl)}`
    );
  });
  connection.on('disconnect', ({ err }) => {
    log(
      `Disconnected from RabbitMQ: ${getPrintableConnectionString(
        connectionUrl
      )}, ${err}`
    );
  });

  return connection;
})();

export const getConnection = () => initPromise;
export const closeMessageBusConnection = async () => {
  log(
    `Closing the connection to RabbitMQ: ${getPrintableConnectionString(
      connectionUrl
    )}`
  );
  await (await getConnection()).close();
  log(`RabbitMQ connection closed.`);

  if (usingCloudAMQP && cloudAmqpInstanceId) {
    await deleteCloudAmqpInstance({ id: cloudAmqpInstanceId });
  }
};
