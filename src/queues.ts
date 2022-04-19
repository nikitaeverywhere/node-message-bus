import { Options } from 'amqplib';
import { getChannel } from './channel';

export const deleteQueue = async (
  queueName: string,
  options?: Options.DeleteQueue
) => {
  const channel = await getChannel();
  const result = await channel.deleteQueue(queueName, options);

  return {
    messageCount: result.messageCount,
  };
};
