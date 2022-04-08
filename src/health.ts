import { getConnection } from './connection';

export const isMessageBusHealthy = async () => {
  const connection = await getConnection();
  return connection.isConnected();
};
