const clientEnv = {
  NEXT_PUBLIC_REDDIT_CLIENT_ID: process.env.NEXT_PUBLIC_REDDIT_CLIENT_ID ?? '',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
};

const serverEnv = {
  REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET ?? '',
};

export const env = {
  ...clientEnv,
  ...serverEnv,
} as const;

// Validate environment variables
export function validateEnv() {
  const missingPublicVars = Object.entries(clientEnv)
    .filter(([key, value]) => key !== 'NEXT_PUBLIC_APP_URL' && !value)
    .map(([key]) => key);

  const missingServerVars = Object.entries(serverEnv)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  const missingVars = [...missingPublicVars, ...missingServerVars];

  if (missingVars.length > 0) {
    console.error('Environment validation failed. Missing variables:', missingVars);
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env.local file.'
    );
  }

  return true;
}
