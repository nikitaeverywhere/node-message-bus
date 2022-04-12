export const getPrintableConnectionString = (string: string) =>
  string.replace(/([a-z]+:\/\/[^:]+)?:[^@]+@/g, '$1:***@');
