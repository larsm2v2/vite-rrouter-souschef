// Production requests stay on the Hosting origin, including custom domains.
export const API_BASE_URL = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_API_URL ?? "");
