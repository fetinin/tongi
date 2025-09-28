import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  allowedDevOrigins: ['*', 'web.telegram.org', '127.0.0.1'],

  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
