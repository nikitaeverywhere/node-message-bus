import {
  NODE_ENV,
  NODE_MESSAGE_BUS_CONNECTION_URL,
  isTestEnv,
  isUsingCloudAmqp,
} from 'Const';
import { error, getPrintableConnectionString, log } from 'Utils';
import amqp from 'amqp-connection-manager';
import {
  cleanupOldCloudAmqpInstances,
  deleteCloudAmqpInstance,
  getNewCloudAmqpInstance,
} from './cloudamqp';
import { amqpConfig } from './config';

let connectionUrl = '';
let cloudAmqpInstanceId = 0;

const useCloudAMQP = isUsingCloudAmqp();

const initPromise = (async () => {
  if (useCloudAMQP) {
    await cleanupOldCloudAmqpInstances();
  }

  connectionUrl = useCloudAMQP
    ? await (async () => {
        const instance = await getNewCloudAmqpInstance();
        cloudAmqpInstanceId = instance?.id || cloudAmqpInstanceId;
        if (!instance) {
          error(
            `Unable to create a new CloudAMQP instance! Using NODE_MESSAGE_BUS_CONNECTION_URL`
          );
        }
        return instance?.url || NODE_MESSAGE_BUS_CONNECTION_URL;
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

  log(
    `${
      isTestEnv() ? '[TEST ENVIRONMENT] ' : ''
    }Connecting to ${getPrintableConnectionString(connectionUrl)}...`
  );

  const connection = amqp.connect([connectionUrl], amqpConfig || undefined);
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
  connection.on('connectFailed', ({ err }) => {
    if (useCloudAMQP) {
      log(
        `Connection failed, likely because CloudAMQP instance is not yet up. Waiting... [${err}]`
      );
    } else {
      log(`Failed to connect to RabbitMQ: ${err}; Retrying...`);
    }
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

  if (useCloudAMQP && cloudAmqpInstanceId) {
    await deleteCloudAmqpInstance({ id: cloudAmqpInstanceId });
  }
};
