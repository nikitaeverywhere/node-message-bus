import { closeMessageBus, initMessageBus } from '../../lib';
import { until } from '../utils';

describe('node-message-bus', () => {
  let logs: string[] = [];

  before(async () => {
    initMessageBus({
      logger: (f, msg) => {
        logs.push(msg);
        console[f](msg);
      },
    });

    await until(() => !!logs.find((log) => log.includes('Failed to connect')));
  });

  after(async () => {
    await closeMessageBus();
  });

  it('outputs connection failure message to a custom logger', async () => {
    // do nothing
  });
});
