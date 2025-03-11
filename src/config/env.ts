// Get the port from the environment or use a default
const getPort = () => {
  if (typeof window !== 'undefined') {
    return window.location.port || '3001';
  }
  return '3001'; // Default to 3001 for server-side
};

const getBaseUrl = () => {
  // If we have a direct environment variable, use it
  if (process.env.NEXT_PUBLIC_APP_URL && 
      process.env.NEXT_PUBLIC_APP_URL !== 'undefined' && 
      process.env.NEXT_PUBLIC_APP_URL !== 'https://undefined') {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // For client-side
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // If we're on Netlify or any non-localhost environment
    if (!hostname.includes('localhost')) {
      return `${protocol}//${hostname}`;
    }
    
    // Local development
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  
  // For server-side local development
  return 'http://localhost:3001';
};

const clientEnv = {
  NEXT_PUBLIC_REDDIT_CLIENT_ID: process.env.NEXT_PUBLIC_REDDIT_CLIENT_ID ?? '',
  NEXT_PUBLIC_APP_URL: getBaseUrl(),
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
  console.log('Debug: Environment Details:', {
    raw_app_url: process.env.NEXT_PUBLIC_APP_URL,
    computed_app_url: clientEnv.NEXT_PUBLIC_APP_URL,
    is_browser: typeof window !== 'undefined',
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
    all_env: {
      ...clientEnv,
      REDDIT_CLIENT_SECRET: serverEnv.REDDIT_CLIENT_SECRET ? '[PRESENT]' : '[MISSING]'
    }
  });

  const missingPublicVars = Object.entries(clientEnv)
    .filter(([key, value]) => {
      // Don't consider NEXT_PUBLIC_APP_URL as missing since we handle it with defaults
      if (key === 'NEXT_PUBLIC_APP_URL') return false;
      
      const isEmpty = !value || value === 'undefined' || value === 'https://undefined';
      if (isEmpty) {
        console.log(`Debug: ${key} is empty or invalid:`, { value });
      }
      return isEmpty;
    })
    .map(([key]) => key);

  const missingServerVars = Object.entries(serverEnv)
    .filter(([key, value]) => {
      const isEmpty = !value;
      if (isEmpty) {
        console.log(`Debug: ${key} is empty`);
      }
      return isEmpty;
    })
    .map(([key]) => key);

  const missingVars = [...missingPublicVars, ...missingServerVars];

  if (missingVars.length > 0) {
    console.error('Environment validation failed. Missing or invalid variables:', {
      missingVars,
      NEXT_PUBLIC_APP_URL: clientEnv.NEXT_PUBLIC_APP_URL,
      hasRedditClientId: !!clientEnv.NEXT_PUBLIC_REDDIT_CLIENT_ID,
      hasRedditSecret: !!serverEnv.REDDIT_CLIENT_SECRET
    });
    throw new Error(
      `Missing or invalid environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env.local file and ensure all variables are set correctly.'
    );
  }

  // Additional validation for APP_URL format
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL;
  if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    console.error('Invalid APP_URL format:', appUrl);
    throw new Error('NEXT_PUBLIC_APP_URL must start with http:// or https://');
  }

  return true;
}
