import {
  CLIENT_ID,
  CLIENT_SECRET,
  DYNAMICS_365_URL,
  TENANT_ID,
} from '@/env.js';
import * as msal from '@azure/msal-node';
import fs from 'fs';

async function loadPreviousAuthResult() {
  const filePath = './.crm_auth_results.json';

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsedData = JSON.parse(data);

      return {
        accessToken: parsedData.accessToken,
        expiresOn: new Date(parsedData.expiresOn),
        tenantId: parsedData.tenantId,
      };
    } catch (error) {
      console.error('Error loading previous auth result:', error);
    }
  }

  return null;
}

export async function getAccessToken() {
  const crmAuthResult = await loadPreviousAuthResult();

  if (
    crmAuthResult &&
    crmAuthResult.expiresOn &&
    crmAuthResult.tenantId === TENANT_ID
  ) {
    // if token is still valid, return it
    if (crmAuthResult.expiresOn.getTime() > Date.now()) {
      return crmAuthResult.accessToken;
    }
  }

  global.BroadcastChannel;
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

    await fs.promises.writeFile(
      './.crm_auth_results.json',
      JSON.stringify({
        accessToken: authResult.accessToken,
        expiresOn: authResult.expiresOn,
        tenantId: TENANT_ID,
      }),
    );

    console.log('New token acquired');

    return authResult.accessToken;
  } catch (error) {
    throw new Error(`Error acquiring token: ${error}`);
  }
}
