import { Options } from 'amqplib';
import { IMessage } from './message';

export interface PublishMessageOptions extends IMessage {
  exchangeName?: string;
  options?: Options.Publish;
}
