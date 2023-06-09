export const getPrintableConnectionString = (string: string) =>
  string.replace(/([a-z]+:\/\/[^:]+)?:[^@]+@/g, '$1:***@');

export const safeJsonStringify = (obj: any) => {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return obj + '';
  }
};
