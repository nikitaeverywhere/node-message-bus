import { ConsumeMessageFields, MessageProperties } from 'amqplib';
import { IMessage } from './message';

export interface MessageHandlerParams<Message extends IMessage>
  extends MessageProperties,
    ConsumeMessageFields {
  failThisMessage: (error?: Error) => Promise<void>;
  key: Message['key'];
  body: Message['body'];
}

export type MessageHandler<Message extends IMessage = IMessage> = (
  arg: MessageHandlerParams<Message>
) => any;
