import { getChannel } from './channel';

export const purgeQueue = async ({ queueName }: { queueName: string }) => {
  const channel = await getChannel();

  return await channel.purgeQueue(queueName);
};
