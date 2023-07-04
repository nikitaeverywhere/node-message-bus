import { NODE_ENV, NODE_MESSAGE_BUS_CONNECTION_URL, isTestEnv } from 'Const';
import { error, getPrintableConnectionString, log } from 'Utils';
import amqp from 'amqp-connection-manager';
import {
  cleanupOldCloudAmqpInstances,
  deleteCloudAmqpInstance,
  getNewCloudAmqpInstance,
} from './cloudamqp';
import { amqpConfig, isUsingCloudAmqp } from './config';

let connectionUrl = '';
let cloudAmqpInstanceId = 0;

let _resolveInitPromise = (m: ReturnType<typeof amqp.connect>) => {};
let initPromise: Promise<ReturnType<typeof amqp.connect>> = new Promise(
  (r) => (_resolveInitPromise = r)
);
let initialized = false;
export const initConnection = async () => {
  if (initialized) {
    return;
  }
  initialized = true;

  const useCloudAMQP = isUsingCloudAmqp();

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
    log(`Connected to AMQP: ${getPrintableConnectionString(connectionUrl)}`);
  });
  connection.on('disconnect', ({ err }) => {
    log(
      `Disconnected from AMQP: ${getPrintableConnectionString(
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
      log(`Failed to connect to AMQP: ${err}; Retrying...`);
    }
  });

  _resolveInitPromise(connection);
  return connection;
};

export const getConnection = () => initPromise;
export const closeMessageBusConnection = async () => {
  log(
    `Closing the connection to AMQP: ${getPrintableConnectionString(
      connectionUrl
    )}`
  );
  await (await getConnection()).close();
  log(`AMQP connection closed.`);

  if (isUsingCloudAmqp() && cloudAmqpInstanceId) {
    await deleteCloudAmqpInstance({ id: cloudAmqpInstanceId });
  }
};
