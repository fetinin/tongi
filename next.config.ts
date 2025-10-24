import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  allowedDevOrigins: ['*', 'web.telegram.org', '127.0.0.1', 'tongi.loca.lt'],

  // Standalone output for Docker - only includes necessary files
  output: 'standalone',

  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
