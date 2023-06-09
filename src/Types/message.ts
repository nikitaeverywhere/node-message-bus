export interface IMessage<
  TRoutingKey extends string = string,
  TData = unknown
> {
  key: TRoutingKey;
  body: TData;
}
