import { connection } from './connection';

export const isMessageBusHealthy = () => {
  return connection.isConnected();
};
