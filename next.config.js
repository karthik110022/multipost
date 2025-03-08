/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize image loading
  images: {
    domains: ['www.reddit.com', 'i.redd.it'],
    minimumCacheTTL: 60,
  },
  // Optimize builds
  swcMinify: true,
  // Optimize for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Environment variables
  env: {
    NEXT_PUBLIC_REDDIT_CLIENT_ID: process.env.NEXT_PUBLIC_REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001',
  },
}

module.exports = nextConfig
