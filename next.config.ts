import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  webpack: (config, {}) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    // Exclude telegram_webapp_example directory
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...((config.watchOptions?.ignored as string[]) || []),
        '**/telegram_webapp_example/**',
      ],
    };

    return config;
  },
};

export default nextConfig;
