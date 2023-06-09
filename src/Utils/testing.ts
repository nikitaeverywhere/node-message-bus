import { LAST_MESSAGES_BUFFER_SIZE, isTestEnv } from 'Const';
import { IMessage } from 'Types';

interface LastMessagesFactory {
  push: <T extends IMessage>(m: T) => void;
  clear: () => number;
  get: <T extends IMessage>() => T[];
}

const lastMessagesFactory = (): LastMessagesFactory => {
  const array: Array<IMessage> = [];
  return {
    push: (m: IMessage) => {
      if (!isTestEnv()) {
        return;
      }
      array.push(m);
      if (array.length > LAST_MESSAGES_BUFFER_SIZE) {
        array.splice(0, 1);
      }
    },
    clear: () => (array.length = 0),
    get: <IMessage>() => array.slice() as IMessage[],
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

export const clearLastMessages = () => {
  clearLastPublishedMessages();
  clearLastConsumedMessages();
  clearLastRejectedMessages();
};
