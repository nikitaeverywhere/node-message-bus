import { closeMessageBus, initMessageBus } from '../../lib';
import { until } from '../utils';

describe('node-message-bus', () => {
  let logs: string[] = [];

  before(async () => {
    await initMessageBus({
      useCloudAmqpTempInstance: {
        apiKey: process.env.AMQP_TEMP || '',
      },
      logger: (f, msg) => {
        logs.push(msg);
        console[f](msg);
      },
    });

    await until(() => !!logs.find((log) => log.includes('Connected to')));
  });

  after(async () => {
    await closeMessageBus();
  });

  it('connects to temp CloudAMQP', async () => {
    // do nothing
  });
});
