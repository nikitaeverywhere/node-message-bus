import {
  CLOUD_AMQP_INSTANCE_NAME_PREFIX,
  CLOUD_AMQP_INSTANCE_TAG,
  CLOUD_AMQP_URL_INSTANCE,
  CLOUD_AMQP_URL_INSTANCES,
  CLOUD_AMQP_URL_REGIONS,
  NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY,
  NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_INSTANCE_LIFETIME,
} from 'Const';
import { error, log } from 'Utils';

const authorizationHeader = `Basic ${Buffer.from(
  `:${NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY || ''}`
).toString('base64')}`;

const getInstancesList = async (): Promise<
  Array<{
    id: number;
    plan: string;
    region: string;
    name: string;
    tags: string[];
    providerid: string;
    vpc_id: string;
  }>
> => {
  let result: any;
  try {
    const res = await fetch(`${CLOUD_AMQP_URL_INSTANCES}`, {
      headers: {
        Authorization: authorizationHeader,
      },
    });
    result = await res.json();
  } catch (e) {
    error(
      `Unable to fetch CloudAMQP instance list at ${CLOUD_AMQP_URL_INSTANCES}, ${e}`
    );
  }

  if (result.error) {
    error(`Unable to request a list of CloudAMQP instances: ${result.error}`);
    return [];
  }

  return result;
};

export const deleteCloudAmqpInstance = async ({
  id,
}: {
  id: number;
}): Promise<void> => {
  log(`Deleting used CloudAMQP temp instance ID=${id}...`);
  try {
    const res = await fetch(`${CLOUD_AMQP_URL_INSTANCE(id.toString())}`, {
      method: 'DELETE',
      headers: {
        Authorization: authorizationHeader,
      },
    });
    (await res.text()) as any;
    log(`CloudAMQP instance with ID=${id} is deleted!`);
  } catch (e: any) {
    error(`Failed to delete CloudAMQP instance with ID=${id}, ${e.stack || e}`);
  }
};

export const cleanupOldCloudAmqpInstances = async () => {
  log(`Querying all instances from CloudAMQP to cleanup old instances...`);
  const list = await getInstancesList();

  for (let instance of list) {
    if (!instance.name.startsWith(CLOUD_AMQP_INSTANCE_NAME_PREFIX)) {
      continue;
    }
    const time = +instance.name.replace(CLOUD_AMQP_INSTANCE_NAME_PREFIX, '');
    if (time && time < Date.now()) {
      await deleteCloudAmqpInstance({ id: instance.id });
    }
  }
};

export const getCloudAmqpRegions = async (): Promise<
  Array<{
    provider: string;
    region: string;
    name: string;
    has_shared_plans: boolean;
  }>
> => {
  let result: any;
  try {
    const res = await fetch(`${CLOUD_AMQP_URL_REGIONS}`, {
      headers: {
        Authorization: authorizationHeader,
      },
    });
    result = await res.json();
  } catch (e) {
    error(
      `Unable to fetch CloudAMQP regions at ${CLOUD_AMQP_URL_REGIONS}, ${e}`
    );
  }

  if (result.error) {
    error(`Unable to request a list of CloudAMQP regions: ${result.error}`);
    return [];
  }

  return result;
};

export const getNewCloudAmqpInstance = async (): Promise<{
  id: number;
  url: string;
  apikey: string;
} | null> => {
  // The potential improvement would be to get the CLOSEST region to where the test runs.
  const instanceRegion = (await getCloudAmqpRegions())[0];

  const newInstanceConfig = {
    name: `${CLOUD_AMQP_INSTANCE_NAME_PREFIX}${
      Date.now() + NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_INSTANCE_LIFETIME
    }`,

    // The "free" plan
    plan: 'lemur',

    region: `${instanceRegion.provider}::${instanceRegion.region}`,
    tags: CLOUD_AMQP_INSTANCE_TAG,
  };

  log(
    `Creating a new temp CloudAMQP instance. Config: ${JSON.stringify(
      newInstanceConfig
    )}`
  );
  let result: any;
  try {
    const res = await fetch(`${CLOUD_AMQP_URL_INSTANCES}`, {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newInstanceConfig),
    });
    result = await res.json();
  } catch (e) {
    error(
      `Unable to fetch CloudAMQP instances at ${CLOUD_AMQP_URL_INSTANCES}, ${e}`
    );
  }

  if (result.error) {
    error(`Unable to create a new CloudAMQP instance: ${result.error}`);
    return null;
  }

  log(`New CloudAMQP instance was created, ID=${result.id}`);

  return result;
};
