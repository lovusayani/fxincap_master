import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  allowedDevOrigins: ['192.168.0.106'],
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  // Proxy API calls so the landing page can read admin-managed branding
  // (platform name / logo) without hardcoding a host. Falls back to the local
  // API in development when NEXT_PUBLIC_API_URL is unset or stale.
  async rewrites() {
    const apiBase = (
      process.env.PLATFORM_API_URL ||
      (process.env.NODE_ENV === 'development' ? 'http://localhost:7000' : process.env.NEXT_PUBLIC_API_URL) ||
      'http://localhost:7000'
    ).replace(/\/$/, '');
    return [{ source: '/platform-api/:path*', destination: `${apiBase}/api/:path*` }];
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
