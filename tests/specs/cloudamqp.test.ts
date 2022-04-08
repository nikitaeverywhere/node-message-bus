import { expect } from 'chai';
import {
  closeMessageBus,
  configureMessageBus,
  consumeMessages,
  DEFAULT_EXCHANGE_NAME,
  initMessageBus,
  isMessageBusHealthy,
  messageBusStopAllConsumers,
  publishMessage,
  publishMessageToQueue,
  purgeQueue,
} from '../../lib';
import { until } from '../utils';

describe('node-message-bus', () => {
  before(async () => {
    await initMessageBus({
      exchanges: [{ name: 'exchange2', type: 'topic' }],
      queues: [
        {
          name: 'test-queue-1',
        },
        {
          name: 'test-queue-2',
        },
        {
          name: 'test-queue-any',
        },
        {
          name: 'test-queue-dead-letter-ttl',
          options: {
            deadLetterExchange: DEFAULT_EXCHANGE_NAME,
            deadLetterRoutingKey: 'automation.run',
            messageTtl: 2000,
          },
        },
        {
          name: 'test-queue-dead-letter-handler',
        },
      ],
      bindings: [
        {
          toQueue: 'test-queue-1',
          routingKey: 'automation.run',
        },
        {
          toQueue: 'test-queue-2',
          routingKey: 'property.proxyEndpoints.newBlacklisted',
        },
        {
          toQueue: 'test-queue-any',
          routingKey: 'automation.*',
        },
        {
          toQueue: 'test-queue-dead-letter-handler',
          routingKey: 'automation.run',
        },
      ],
    });
  });

  after(async () => {
    await closeMessageBus();
  });

  beforeEach(async () => {
    await messageBusStopAllConsumers();
  });

  describe('basic tests', () => {
    it('healthy message bus', async () => {
      expect(await isMessageBusHealthy()).to.be.true;
    });

    it('publishes and consumes a primitive message', async () => {
      const consumePromise = new Promise((r) =>
        consumeMessages({
          queueName: 'test-queue-1',
          handler: r,
        })
      );
      await publishMessage({
        routingKey: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });
      const dataReceived = await consumePromise;

      expect(dataReceived).to.be.deep.equal({
        pipelineId: 'a',
        stepId: 'start',
      });
    });

    it('publishes and consumes a composite message', async () => {
      const consumePromise = new Promise((r) =>
        consumeMessages({
          queueName: 'test-queue-1',
          handler: r,
        })
      );
      await publishMessage({
        routingKey: 'automation.run',
        body: {
          pipelineId: 'b',
          stepId: 'start',
        },
      });
      const dataReceived = await consumePromise;

      expect(dataReceived).to.be.deep.equal({
        pipelineId: 'b',
        stepId: 'start',
      });
    });

    it('publishes and consumes a wildcard routing key message', async () => {
      await purgeQueue({ queueName: 'test-queue-any' });
      const consumePromise = new Promise((r) =>
        consumeMessages({
          queueName: 'test-queue-any',
          handler: r,
        })
      );
      await publishMessage({
        routingKey: 'automation.new',
        body: {
          type: 'step2',
          args: {
            propertyId: 'x',
            proxyEndpointUrlKey: 'a',
          },
        },
      });
      const dataReceived = await consumePromise;

      expect(dataReceived).to.be.deep.equal({
        type: 'step2',
        args: {
          propertyId: 'x',
          proxyEndpointUrlKey: 'a',
        },
      });
    });

    it('publishes and consumes a message sent to queue', async () => {
      const consumePromise = new Promise((r) =>
        consumeMessages({
          queueName: 'test-queue-1',
          handler: r,
        })
      );
      await publishMessageToQueue({
        queueName: 'test-queue-1',
        body: { pipelineId: 'b', stepId: 'start' },
      });
      const dataReceived = await consumePromise;

      expect(dataReceived).to.be.deep.equal({
        pipelineId: 'b',
        stepId: 'start',
      });
    });

    it('publishes and consumes multiple messages', async () => {
      const consumedMessages: any[] = [];
      await Promise.all(
        [1, 2, 3].map((i) =>
          publishMessage({
            routingKey: 'automation.run',
            body: {
              pipelineId: i.toString(),
              stepId: 'start',
            },
          })
        )
      );
      consumeMessages({
        queueName: 'test-queue-1',
        handler: (data) => {
          consumedMessages.push(data);
        },
      });

      await new Promise((resolve) => {
        const int = setInterval(() => {
          if (consumedMessages.length !== 3) {
            return;
          }
          clearInterval(int);
          resolve(1);
        }, 50);
      });

      expect(
        consumedMessages.sort((a, b) => +a.pipelineId - +b.pipelineId)
      ).to.be.deep.equal(
        [1, 2, 3].map((n) => ({
          pipelineId: n.toString(),
          stepId: 'start',
        }))
      );
    });

    it('purges queue', async () => {
      const queueName = 'test-queue-dead-letter-ttl';
      const queueHandler = 'test-queue-dead-letter-handler';
      const consumedMessages: any[] = [];
      await purgeQueue({
        queueName: queueHandler,
      });
      await consumeMessages({
        queueName: queueHandler,
        handler: (data) => {
          consumedMessages.push(data);
        },
      });
      await publishMessageToQueue({
        queueName,
        body: { pipelineId: 'a', stepId: 'start' },
      });
      await purgeQueue({
        queueName,
      });

      await new Promise((r) => setTimeout(r, 2000));

      expect(consumedMessages).to.have.length(0);
    });
  });

  describe('errors', () => {
    it('uses exponential backoff for failed deliveries', async () => {
      let handledTimes: number[] = [];
      let handledData: any;
      consumeMessages({
        queueName: 'test-queue-1',
        handler: async (data, { headers }) => {
          console.log(
            `Handling new message: ${data}, headers: ${JSON.stringify(headers)}`
          );
          handledTimes.push(Date.now());
          if (handledTimes.length === 3) {
            handledData = data;
          } else {
            throw new Error('dummy error - expected in test');
          }
        },
      });
      await publishMessage({
        routingKey: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });

      // Wait for data.
      await new Promise((resolve) => {
        const int = setInterval(() => {
          if (handledTimes.length === 3) {
            clearInterval(int);
            resolve(1);
          }
        }, 50);
      });

      const d1 = handledTimes[1] - handledTimes[0];
      const d2 = handledTimes[2] - handledTimes[1];
      expect(d1).to.be.greaterThanOrEqual(1000);
      expect(d1).to.be.lessThanOrEqual(3000);
      expect(d2).to.be.greaterThanOrEqual(4000);
      expect(d2).to.be.lessThanOrEqual(6000);
      expect(handledData).to.be.deep.equal({
        pipelineId: 'a',
        stepId: 'start',
      });
    });
  });

  it('allows to configure additional queues in runtime', async () => {
    await configureMessageBus({
      queues: [
        {
          name: 'dynamic-queue',
        },
      ],
      bindings: [
        {
          toQueue: 'dynamic-queue',
          routingKey: 'notification.user',
        },
      ],
    });

    const consumedMessages: any[] = [];
    await consumeMessages({
      queueName: 'dynamic-queue',
      handler: (data) => {
        consumedMessages.push(data);
      },
    });

    const random = Math.random().toString();
    await publishMessage({
      routingKey: 'notification.user',
      body: {
        recipientUserId: random,
        notification: {
          id: 'automationPipelineFailed',
          data: {
            pipelineId: '',
          },
        },
      },
    });

    await until(() => consumedMessages.length === 1);

    expect(consumedMessages[0].recipientUserId).to.be.equal(random);
  });
});
