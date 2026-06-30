const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TOKEN_CACHE_FILE = path.join(__dirname, '..', '.dropbox-token-cache.json');

async function getDropboxAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const legacyToken = process.env.DROPBOX_ACCESS_TOKEN;

  if (refreshToken && appKey && appSecret) {
    return await getAccessTokenFromRefresh(refreshToken, appKey, appSecret);
  }

  if (legacyToken) {
    console.warn('⚠️  Using legacy access token (expires in 4 hours)');
    return legacyToken;
  }

  throw new Error('No Dropbox credentials found! Set DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET in .env');
}

async function getAccessTokenFromRefresh(refreshToken, appKey, appSecret) {
  const cached = loadCachedToken();
  if (cached && cached.expires_at > Date.now() + 300000) {
    console.log('✅ Using cached access token');
    return cached.access_token;
  }

  console.log('🔄 Refreshing access token...');

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const cacheData = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000)
  };
  saveCachedToken(cacheData);

  console.log(`✅ New access token obtained (expires in ${Math.round(data.expires_in / 3600)}h)`);
  return data.access_token;
}

function loadCachedToken() {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('⚠️  Failed to load token cache:', e.message);
  }
  return null;
}

function saveCachedToken(data) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️  Failed to save token cache:', e.message);
  }
}

function clearCachedToken() {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      fs.unlinkSync(TOKEN_CACHE_FILE);
    }
  } catch (e) {
    console.warn('⚠️  Failed to clear token cache:', e.message);
  }
}

module.exports = { getDropboxAccessToken, clearCachedToken };
