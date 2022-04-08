export const until = async (f: () => Promise<boolean> | boolean) => {
  while (true) {
    if (await f()) {
      break;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
};

export const resetEnvs = (envs: { [key: string]: string } = {}) => {
  process.env.NODE_ENV = 'development';
  process.env.NODE_MESSAGE_BUS_CONNECTION_URL = undefined;
  process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_NAME = 'default';
  process.env.NODE_MESSAGE_BUS_DEFAULT_EXCHANGE_TYPE = 'direct';
  process.env.NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_API_KEY = undefined;
  process.env.NODE_MESSAGE_BUS_TESTING_CLOUDAMQP_INSTANCE_LIFETIME = undefined;

  for (const [key, value] of Object.entries(envs)) {
    if (value === '') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};
