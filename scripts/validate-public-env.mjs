import { existsSync, readFileSync } from 'node:fs';

function readDotEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

const local = readDotEnv('.env');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || local.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || local.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const problems = [];
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl || '')) {
  problems.push('EXPO_PUBLIC_SUPABASE_URL must be a hosted Supabase HTTPS URL');
}
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '')) {
  problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key');
}

if (problems.length) {
  console.error(`Backend build guard failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

console.log('Backend build guard passed.');
