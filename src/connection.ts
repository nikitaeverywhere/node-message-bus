import amqp from 'amqp-connection-manager';
import { getPrintableConnectionString, log } from 'Utils';

const connectionUrl = process.env.AMQP_URL;

if (!connectionUrl) {
  throw new Error(
    `FATAL: pkg-message-bus requires AMQP_URL environment variable to be set.`
  );
}

export const connection = amqp.connect([connectionUrl]);

connection.on('connect', () => {
  log(`Connected to RabbitMQ: ${getPrintableConnectionString(connectionUrl)}`);
});

connection.on('disconnect', ({ err }) => {
  log(
    `Disconnected from RabbitMQ: ${getPrintableConnectionString(
      connectionUrl
    )}, ${err}`
  );
});

export const closeMessageBusConnection = async () => {
  log(
    `Closing the connection to RabbitMQ: ${getPrintableConnectionString(
      connectionUrl
    )}`
  );
  await connection.close();
  log(`RabbitMQ connection closed.`);
};
