import { Options } from 'amqplib';
import { getDefaultChannel } from './channel';

export const deleteQueue = async (
  queueName: string,
  options?: Options.DeleteQueue
) => {
  const channel = await getDefaultChannel();
  const result = await channel.deleteQueue(queueName, options);

  return {
    messageCount: result.messageCount,
  };
};
