/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_REDDIT_CLIENT_ID: process.env.NEXT_PUBLIC_REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  },
}

module.exports = nextConfig
