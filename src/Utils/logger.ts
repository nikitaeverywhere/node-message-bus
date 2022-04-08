let defaultLoggerFunction = (
  logType: 'log' | 'warn' | 'error' | 'info',
  message: string
) =>
  console[logType](
    `${new Date().toLocaleString()} node-message-bus: ${message}`
  );

export const setLoggerFunction = (f: typeof defaultLoggerFunction) => {
  defaultLoggerFunction = f;
};

export const log = (message: string) => defaultLoggerFunction('log', message);
export const info = (message: string) => defaultLoggerFunction('info', message);
export const warn = (message: string) => defaultLoggerFunction('warn', message);
export const error = (message: string) =>
  defaultLoggerFunction('error', message);
