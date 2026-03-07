import {
  CLIENT_ID,
  CLIENT_SECRET,
  DYNAMICS_365_URL,
  TENANT_ID,
} from '@/env.js';
import { logger } from '@/logger.js';
import * as msal from '@azure/msal-node';
import fs from 'fs';

async function createHash(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

interface AuthResult {
  accessToken: string;
  expiresOn: string;
}

const AUTH_RESULT_CACHE_FILE_PATH = './.crm_auth_results.json';
const authResultCache: Record<string, AuthResult> = {};

function loadAuthResultCache() {
  if (!fs.existsSync(AUTH_RESULT_CACHE_FILE_PATH)) {
    return;
  }

  try {
    const data = fs.readFileSync(AUTH_RESULT_CACHE_FILE_PATH, 'utf-8');
    const parsedData = JSON.parse(data);

    if (!parsedData.version) {
      logger.warn('Auth result cache file is missing version. Ignoring cache.');
      return;
    }

    if (parsedData.version !== '1.0') {
      logger.warn(
        `Auth result cache version mismatch. Expected 1.0 but got ${parsedData.version}. Ignoring cache.`,
      );
      return;
    }

    Object.assign(authResultCache, parsedData.data);

    let requiredSave = false;

    Object.entries(authResultCache).forEach(([hash, item]) => {
      // Expired or expiring in next 30 sdeconds
      const isExpiring =
        new Date(item.expiresOn).getTime() <= Date.now() + 30 * 1000;

      if (!isExpiring) return;

      requiredSave = true;
      delete authResultCache[hash];
    });

    if (requiredSave) {
      saveAuthResultCache();
    }
  } catch (error) {
    logger.error('Error loading previous auth result', error);
  }
}

function saveAuthResultCache() {
  const cacheData = {
    version: '1.0',
    data: authResultCache,
  };

  try {
    fs.writeFileSync(
      AUTH_RESULT_CACHE_FILE_PATH,
      JSON.stringify(cacheData, null, 2),
      'utf-8',
    );
  } catch (error) {
    logger.error('Error saving auth result cache', error);
  }
}

export async function getAccessToken() {
  loadAuthResultCache();
  const hash = await createHash(`${TENANT_ID}-${CLIENT_ID}-${CLIENT_SECRET}`);

  const crmAuthResult = authResultCache[hash];

  if (crmAuthResult) {
    // if token already exists than return it
    return crmAuthResult.accessToken;
  }

  const tokenRequest = {
    scopes: [`${DYNAMICS_365_URL}/.default`],
  };

  const cca = new msal.ConfidentialClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      clientSecret: CLIENT_SECRET,
    },
  });

  try {
    const authResult = await cca.acquireTokenByClientCredential(tokenRequest);
    if (!authResult?.accessToken) {
      throw new Error('Token acquisition failed');
    }

    if (authResult.expiresOn) {
      authResultCache[hash] = {
        accessToken: authResult.accessToken,
        expiresOn: authResult.expiresOn.toISOString(),
      };

      saveAuthResultCache();
    }

    logger.info('New token acquired');

    return authResult.accessToken;
  } catch (error) {
    throw new Error(`Error acquiring token: ${error}`);
  }
}
