import { getDefaultChannel } from './channel';
import { getMessageBusConfig } from './config';

/** Purges a single queue. */
export const purgeQueue = async (opts: string | { queueName: string }) => {
  const channel = await getDefaultChannel();

  return await channel.purgeQueue(
    typeof opts === 'string' ? opts : opts.queueName
  );
};

/**
 * Purges all configured queues during this instance run. It won't purge queues that were created in other processes.
 *
 * Returns the number of purged messages.
 */
export const purgeAllQueues = async () => {
  const result = await Promise.all(
    getMessageBusConfig().queues.map((q) => purgeQueue({ queueName: q.name }))
  );
  return result.reduce((a, b) => a + b.messageCount, 0);
};
