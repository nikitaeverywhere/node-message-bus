export interface IMessage<
  TRoutingKey extends string = string,
  TData = unknown
> {
  routingKey: TRoutingKey;
  data: TData;
}
