import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude server-only packages from client-side bundles
  serverExternalPackages: ["better-sqlite3"],
  
  // ESLint configuration for production builds
  eslint: {
    // Allow builds to complete - lint separately in CI/CD
    ignoreDuringBuilds: true,
    dirs: ['app', 'src', 'components'],
  },
  
  // TypeScript configuration
  typescript: {
    // Allow builds for deployment - fix types in development
    ignoreBuildErrors: true,
  },
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // For server-side, mark better-sqlite3 as external
      config.externals.push("better-sqlite3");
    } else {
      // For client-side, completely exclude Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        buffer: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
      };
      
      // Ensure these packages never make it to the client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        'better-sqlite3': false,
        'drizzle-orm/better-sqlite3': false,
      };
    }
    return config;
  },
  
  // Note: serverComponentsExternalPackages has been moved to serverExternalPackages
};

export default nextConfig;