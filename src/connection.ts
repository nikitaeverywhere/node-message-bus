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

let connectionUrl = '';
let cloudAmqpInstanceId = 0;

const usingCloudAMQP =
  NODE_ENV.startsWith('test') && NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY;

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
    if (NODE_ENV.startsWith('test')) {
      throw new Error(
        `FATAL: node-message-bus requires either NODE_MESSAGE_BUS_CONNECTION_URL or NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY environment variable to be set.`
      );
    } else {
      throw new Error(
        `FATAL: node-message-bus requires NODE_MESSAGE_BUS_CONNECTION_URL environment variable to be set. You can also use NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY in conjunction with NODE_ENV=test.`
      );
    }
  }

  log(`Trying to connect to ${getPrintableConnectionString(connectionUrl)}...`);
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
