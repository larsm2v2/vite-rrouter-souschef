export const isTest = process.env.NODE_ENV === "test";
export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = !isTest && !isProduction;

export default {
  isTest,
  isProduction,
  isDevelopment,
};
