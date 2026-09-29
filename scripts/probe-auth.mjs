import fs from 'node:fs';
import process from 'node:process';

function envFileValues() {
  if (!fs.existsSync('.env')) return {};
  return Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
}

const fileEnv = envFileValues();
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const productionReturnTo = 'https://wayvee.app/';

if (!url || !key) throw new Error('Supabase public environment is missing.');

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers });
if (!settingsResponse.ok) throw new Error(`Supabase auth settings returned ${settingsResponse.status}.`);
const settings = await settingsResponse.json();

if (settings.disable_signup) throw new Error('Supabase account creation is disabled.');
if (!settings.external?.email) throw new Error('Email authentication is disabled.');
if (!settings.external?.google) throw new Error('Google authentication is disabled.');
if (settings.external?.apple) throw new Error('Apple authentication should remain disabled.');
if (settings.external?.anonymous_users) throw new Error('Anonymous authentication should remain disabled.');

const authorize = new URL(`${url}/auth/v1/authorize`);
authorize.searchParams.set('provider', 'google');
authorize.searchParams.set('redirect_to', productionReturnTo);
const oauthResponse = await fetch(authorize, { headers, redirect: 'manual' });
const googleLocation = oauthResponse.headers.get('location') || '';

if (oauthResponse.status !== 302) throw new Error(`Google OAuth start returned ${oauthResponse.status}, expected 302.`);
if (!googleLocation.startsWith('https://accounts.google.com/')) throw new Error('Google OAuth did not hand off to accounts.google.com.');
if (!googleLocation.includes(encodeURIComponent(productionReturnTo))) throw new Error('Google OAuth did not preserve the production Wayvee return URL.');
if (!googleLocation.includes(encodeURIComponent(`${url}/auth/v1/callback`))) throw new Error('Google OAuth is missing the Supabase callback URL.');

const accountTables = ['profiles', 'user_preferences', 'user_plans', 'venue_follows', 'saved_places'];
for (const table of accountTables) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  if (![401, 403].includes(response.status)) {
    throw new Error(`${table} should reject unauthenticated reads; received ${response.status}.`);
  }
  const body = await response.text();
  if (!body.includes('42501')) throw new Error(`${table} did not return the expected database privilege denial.`);
}

console.log(`Supabase auth probe passed: email signup enabled, Google enabled, Apple/guest disabled, production return URL preserved, ${accountTables.length} account tables protected from anonymous reads.`);
