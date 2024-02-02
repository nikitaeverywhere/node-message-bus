import { expect } from 'chai';
import {
  DEFAULT_EXCHANGE_NAME,
  IMessage,
  clearLastMessages,
  closeMessageBus,
  configureMessageBus,
  consumeMessages,
  deleteQueue,
  getLastConsumedMessages,
  getLastPublishedMessages,
  getLastRejectedMessages,
  initMessageBus,
  isMessageBusHealthy,
  messageBusStopAllConsumers,
  publishMessage,
  publishMessageToQueue,
  purgeAllQueues,
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
        {
          name: 'test-queue-backoff-1',
        },
        {
          name: 'test-queue-backoff-2',
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
        {
          toQueue: 'test-queue-backoff-1',
          routingKey: 'backoff.*',
        },
        {
          toQueue: 'test-queue-backoff-2',
          routingKey: 'backoff.*',
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
      interface MessageType extends IMessage {
        key: 'automation.run';
        body: { pipelineId: string; stepId: string };
      }
      const consumePromise = new Promise((r) =>
        consumeMessages<MessageType>('test-queue-1', ({ body }) => r(body))
      );
      await publishMessage<MessageType>({
        key: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });
      const bodyReceived = await consumePromise;

      expect(bodyReceived).to.be.deep.equal({
        pipelineId: 'a',
        stepId: 'start',
      });
    });

    it('publishes and consumes a composite message', async () => {
      const consumePromise = new Promise((r) =>
        consumeMessages('test-queue-1', ({ body }) => r(body))
      );
      await publishMessage({
        key: 'automation.run',
        body: {
          pipelineId: 'b',
          stepId: 'start',
        },
      });
      const bodyReceived = await consumePromise;

      expect(bodyReceived).to.be.deep.equal({
        pipelineId: 'b',
        stepId: 'start',
      });
    });

    it('publishes and consumes a wildcard routing key message', async () => {
      await purgeQueue({ queueName: 'test-queue-any' });
      const consumePromise = new Promise((r) =>
        consumeMessages('test-queue-any', ({ body }) => r(body))
      );
      await publishMessage({
        key: 'automation.new',
        body: {
          type: 'step2',
          args: {
            propertyId: 'x',
            proxyEndpointUrlKey: 'a',
          },
        },
      });
      const bodyReceived = await consumePromise;

      expect(bodyReceived).to.be.deep.equal({
        type: 'step2',
        args: {
          propertyId: 'x',
          proxyEndpointUrlKey: 'a',
        },
      });
    });

    it('publishes and consumes a message sent to queue', async () => {
      const consumePromise = new Promise((r) =>
        consumeMessages('test-queue-1', ({ body }) => r(body))
      );
      await publishMessageToQueue({
        queueName: 'test-queue-1',
        body: { pipelineId: 'b', stepId: 'start' },
      });
      const bodyReceived = await consumePromise;

      expect(bodyReceived).to.be.deep.equal({
        pipelineId: 'b',
        stepId: 'start',
      });
    });

    it('publishes and consumes multiple messages', async () => {
      type MessageType = IMessage<
        'automation.run',
        {
          pipelineId: string;
          stepId: string;
        }
      >;
      const consumedMessages: any[] = [];
      await Promise.all(
        [1, 2, 3].map((i) =>
          publishMessage<MessageType>({
            key: 'automation.run',
            body: {
              pipelineId: i.toString(),
              stepId: 'start',
            },
          })
        )
      );
      consumeMessages<MessageType>('test-queue-1', ({ body }) => {
        consumedMessages.push(body);
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
      await consumeMessages(queueHandler, ({ body }) => {
        consumedMessages.push(body);
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

    it('purges all queues', async () => {
      const queueName = 'test-queue-dead-letter-ttl';
      const queueHandler = 'test-queue-dead-letter-handler';
      const consumedMessages: any[] = [];
      await purgeAllQueues();
      await consumeMessages(queueHandler, ({ body }) => {
        consumedMessages.push(body);
      });
      await publishMessageToQueue({
        queueName,
        body: { pipelineId: 'a', stepId: 'start' },
      });
      await purgeAllQueues();

      await new Promise((r) => setTimeout(r, 1000));

      expect(consumedMessages).to.have.length(0);
    });

    it('deletes a queue', async () => {
      const tempQueueName = `temp-${Math.random().toString().slice(2, 7)}`;
      const key = 'deletetest.test.test';
      await configureMessageBus({
        queues: [
          {
            name: tempQueueName,
          },
        ],
        bindings: [
          {
            routingKey: key,
            toQueue: tempQueueName,
          },
        ],
      });
      await publishMessage({
        key: key,
        body: { test: 1 },
      });
      await new Promise((r) => setTimeout(r, 500));
      const { messageCount } = await deleteQueue(tempQueueName);

      expect(messageCount).to.be.equal(1);

      // Retry and ensure no messages.
      await publishMessage({
        key: key,
        body: { test: 1 },
      });
      await new Promise((r) => setTimeout(r, 500));
      const res = await deleteQueue(tempQueueName);

      expect(res.messageCount).to.be.equal(0);
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
    await consumeMessages('dynamic-queue', ({ body }) => {
      consumedMessages.push(body);
    });

    const random = Math.random().toString();
    await publishMessage({
      key: 'notification.user',
      body: {
        recipientUserId: random,
        notification: {
          id: 'automationPipelineFailed',
          body: {
            pipelineId: '',
          },
        },
      },
    });

    await until(() => consumedMessages.length === 1);

    expect(consumedMessages[0].recipientUserId).to.be.equal(random);
  });

  it('sequential consumption', async () => {
    const consumedMessages: any[] = [];
    await consumeMessages(
      {
        queues: [{ name: 'the-sequential' }],
        bindings: [
          {
            toQueue: 'the-sequential',
            routingKey: 'the.test.sequential',
          },
        ],
        prefetchCount: 1,
      },
      async ({ body }) => {
        const job = Math.random().toString(36).slice(2);
        const start = Date.now();
        console.log(`Job ${job} start at ${start}`);
        await new Promise((r) => setTimeout(r, 500));
        consumedMessages.push({ start, end: Date.now(), body });
        console.log(
          `Job ${job} end at ${
            consumedMessages[consumedMessages.length - 1].end
          }`
        );
      }
    );

    const publish = (x: number) =>
      publishMessage({
        key: 'the.test.sequential',
        body: {
          x,
        },
      });
    await Promise.all([publish(1), publish(2), publish(3)]);

    await new Promise((r) => {
      const int = setInterval(() => {
        if (consumedMessages.length === 3) {
          clearInterval(int);
          r(null);
        }
      }, 25);
    });

    expect(consumedMessages.map((m) => m.body.x)).to.deep.equal([1, 2, 3]);
    consumedMessages
      .map((m) => m.end - m.start)
      .forEach((v) => expect(v).to.be.greaterThanOrEqual(500));
    consumedMessages
      .map((m, i, arr) => (i === 0 ? 0 : m.start - arr[i - 1].start))
      .slice(1)
      .forEach((v) => {
        expect(v).to.be.greaterThanOrEqual(500);
        expect(v).to.be.lessThanOrEqual(1000);
      });
  });

  describe('errors', () => {
    it('uses exponential backoff for failed deliveries', async () => {
      let handledTimes: number[] = [];
      let handledData: any;
      consumeMessages('test-queue-1', async ({ body, headers }) => {
        console.log(
          `Handling new message: ${body}, headers: ${JSON.stringify(headers)}`
        );
        handledTimes.push(Date.now());
        if (handledTimes.length === 3) {
          handledData = body;
        } else {
          throw new Error('dummy error - expected in test');
        }
      });
      await publishMessage({
        key: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });

      // Wait for body.
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

    it('allows to manually nack/backoff the message', async () => {
      let handledTimes: number[] = [];
      let handledData: any;
      consumeMessages(
        'test-queue-1',
        async ({ body, headers, failThisMessage }) => {
          console.log(
            `Handling new message: ${body}, headers: ${JSON.stringify(headers)}`
          );
          handledTimes.push(Date.now());
          if (handledTimes.length === 3) {
            handledData = body;
          } else {
            await failThisMessage();
          }
        }
      );
      await publishMessage({
        key: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });

      // Wait for body.
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

    it('triggers only target queue handler when in backoff', async () => {
      let handledTimes1: number[] = [];
      let handledTimes2: number[] = [];
      let handledData1: any;
      let handledData2: any;

      consumeMessages('test-queue-backoff-1', async ({ body, headers }) => {
        console.log(
          `Handling new message in queue 1: ${body}, headers: ${JSON.stringify(
            headers
          )}`
        );
        handledTimes1.push(Date.now());
        if (handledTimes1.length === 3) {
          handledData1 = body;
        } else {
          throw new Error('dummy error - expected in test');
        }
      });
      consumeMessages('test-queue-backoff-2', async ({ body, headers }) => {
        console.log(
          `Handling new message in queue 2: ${body}, headers: ${JSON.stringify(
            headers
          )}`
        );
        handledTimes2.push(Date.now());
        handledData2 = body;
      });

      await publishMessage({
        key: 'backoff.test',
        body: {
          hello: 1,
        },
      });

      // Wait for body.
      await new Promise((resolve) => {
        const int = setInterval(() => {
          if (handledTimes1.length === 3) {
            clearInterval(int);
            resolve(1);
          }
        }, 50);
      });

      const d1 = handledTimes1[1] - handledTimes1[0];
      const d2 = handledTimes1[2] - handledTimes1[1];
      expect(d1).to.be.greaterThanOrEqual(1000);
      expect(d1).to.be.lessThanOrEqual(3000);
      expect(d2).to.be.greaterThanOrEqual(4000);
      expect(d2).to.be.lessThanOrEqual(6000);
      expect(handledData1).to.be.deep.equal({ hello: 1 });
      expect(handledTimes1.length).to.be.equal(3);
      expect(handledTimes2.length).to.be.equal(1);
      expect(handledData2).to.be.deep.equal({ hello: 1 });
    });
  });

  describe('testing helper functions', () => {
    beforeEach(async () => {
      await clearLastMessages();
    });

    it('populates last published messages queue', async () => {
      await publishMessage({
        key: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });

      expect(getLastPublishedMessages()).to.be.deep.equal([
        {
          key: 'automation.run',
          body: {
            pipelineId: 'a',
            stepId: 'start',
          },
        },
      ]);
      expect(getLastConsumedMessages()).to.be.deep.equal([]);
      expect(getLastRejectedMessages()).to.be.deep.equal([]);

      const consumePromise = new Promise((r) =>
        consumeMessages('test-queue-1', ({ body }) => r(body))
      );
      await consumePromise;
    });

    it('populates last consumed messages queue', async () => {
      const consumePromise = new Promise((r) =>
        consumeMessages('test-queue-1', ({ body }) => {
          setTimeout(() => r(body), 0);
        })
      );
      await publishMessage({
        key: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });
      await consumePromise;

      expect(getLastConsumedMessages()).to.be.deep.equal([
        {
          key: 'automation.run',
          body: {
            pipelineId: 'a',
            stepId: 'start',
          },
        },
      ]);
      expect(getLastRejectedMessages()).to.be.deep.equal([]);
    });

    it('populates last rejected messages queue', async () => {
      consumeMessages('test-queue-1', () => {
        throw new Error('test - expected error');
      });
      await publishMessage({
        key: 'automation.run',
        body: {
          pipelineId: 'a',
          stepId: 'start',
        },
      });

      await until(() => getLastRejectedMessages().length === 1);

      expect(getLastConsumedMessages()).to.be.deep.equal([]);
      expect(getLastRejectedMessages()).to.be.deep.equal([
        {
          key: 'automation.run',
          body: {
            pipelineId: 'a',
            stepId: 'start',
          },
        },
      ]);
    });

    it('indeed clears last messages', () => {
      expect(getLastConsumedMessages()).to.have.length(0);
      expect(getLastPublishedMessages()).to.have.length(0);
      expect(getLastRejectedMessages()).to.have.length(0);
    });
  });
});
