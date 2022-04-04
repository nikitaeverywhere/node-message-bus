let loggerFunction = (
  logType: 'log' | 'warn' | 'error' | 'info',
  message: string
) => console[logType](message);

export const setLoggerFunction = (f: typeof loggerFunction) => {
  loggerFunction = f;
};

export const log = (message: string) => loggerFunction('log', message);
export const info = (message: string) => loggerFunction('info', message);
export const warn = (message: string) => loggerFunction('warn', message);
export const error = (message: string) => loggerFunction('error', message);
