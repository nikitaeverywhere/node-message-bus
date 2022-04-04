export const getPrintableConnectionString = (string: string) =>
  string.replace(/:[^@]+@/g, ':***@');
