import { LAST_MESSAGES_BUFFER_SIZE, isTestEnv } from 'Const';
import { IMessage, PublishMessageOptions } from 'Types';
import { error } from './logger';

interface LastMessagesFactory<T extends IMessage> {
  /** When promise is given, the system will await on it before clearing messages. */
  push: (m: T, promise?: Promise<any>) => void;
  /** Clear last published messages and also await on publishing all pending messages. */
  clear: () => Promise<number>;
  get: () => T[];
}

const lastMessagesFactory = <
  T extends IMessage & PublishMessageOptions
>(): LastMessagesFactory<T> => {
  const array: Array<{ message: T; promise?: Promise<any> }> = [];
  return {
    push: (m: T, promise?: Promise<any>) => {
      if (!isTestEnv()) {
        return;
      }
      array.push({ message: m, promise });
      if (array.length > LAST_MESSAGES_BUFFER_SIZE) {
        array.splice(0, 1);
      }
    },
    clear: async () => {
      const promises = array.filter((e) => !!e.promise).map((e) => e.promise!);
      try {
        await Promise.all(promises);
      } catch (e) {
        error(
          `Error when trying to clear last messages: awaiting for the messages publishing promises failed.`
        );
      }
      array.length = 0;
      return 0;
    },
    get: () => array.map((e) => e.message).slice(),
  };
};

export const {
  push: pushToLastPublishedMessages,
  clear: clearLastPublishedMessages,
  get: getLastPublishedMessages,
} = lastMessagesFactory();
export const {
  push: pushToLastConsumedMessages,
  clear: clearLastConsumedMessages,
  get: getLastConsumedMessages,
} = lastMessagesFactory();
export const {
  push: pushToLastRejectedMessages,
  clear: clearLastRejectedMessages,
  get: getLastRejectedMessages,
} = lastMessagesFactory();

export const clearLastMessages = async () => {
  await clearLastPublishedMessages();
  await clearLastConsumedMessages();
  await clearLastRejectedMessages();
};
