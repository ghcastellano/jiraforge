/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.atlassian.net' },
      { protocol: 'https', hostname: 'avatar-management--avatars.server-location.prod.public.atl-paas.net' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-internal-key' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
