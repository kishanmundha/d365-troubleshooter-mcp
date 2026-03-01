if (!process.env.CLIENT_ID) {
  throw new Error('CLIENT_ID is not set');
}

if (!process.env.CLIENT_SECRET) {
  throw new Error('CLIENT_SECRET is not set');
}

if (!process.env.TENANT_ID) {
  throw new Error('TENANT_ID is not set');
}

if (!process.env.DYNAMICS_365_URL) {
  throw new Error('DYNAMICS_365_URL is not set');
}

export const CLIENT_ID = process.env.CLIENT_ID;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
export const TENANT_ID = process.env.TENANT_ID;
export const DYNAMICS_365_URL = process.env.DYNAMICS_365_URL;
