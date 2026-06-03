import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },
}

export default nextConfig
