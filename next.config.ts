import type { NextConfig } from "next";

// Bundle analyzer setup
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Essential server-only packages exclusion
  serverExternalPackages: [
    "better-sqlite3",
    "expo-secure-store", 
    "expo-modules-core",
    "react-native",
    "@react-native-async-storage/async-storage",
    // OpenTelemetry packages
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/instrumentation",
    "@opentelemetry/sdk-node",
    "@opentelemetry/resources",
    "@opentelemetry/exporter-jaeger",
    "@opentelemetry/exporter-prometheus",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-metrics"
  ],

  // Build configuration - enable checks for verification
  typescript: {
    ignoreBuildErrors: false,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Essential optimizations only
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu', 
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@tanstack/react-query',
      'lucide-react',
      'recharts'
    ],
    optimizeCss: true,
  },

  webpack: (config, { isServer, dev }) => {
    // Essential module exclusions only
    if (!isServer) {
      // Basic fallbacks for client-side
      config.resolve.fallback = {
        fs: false,
        path: false,
        os: false,
        crypto: false,
        // Expo/React Native exclusions
        'expo-secure-store': false,
        'expo-modules-core': false,
        'react-native': false,
        '@react-native-async-storage/async-storage': false,
        // OpenTelemetry exclusions
        '@opentelemetry/auto-instrumentations-node': false,
        '@opentelemetry/instrumentation': false,
        '@opentelemetry/sdk-node': false,
        '@grpc/grpc-js': false,
      };

      // Basic tree-shaking for production
      if (!dev) {
        config.module.rules.push({
          test: /[\\/]node_modules[\\/](lucide-react|@radix-ui|date-fns|clsx|zod)[\\/]/,
          sideEffects: false,
        });
      }
    }

    // Server-side exclusions
    if (isServer) {
      config.externals.push("expo-modules-core", "expo-secure-store");
      
      // Essential webpack plugins only
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.LOGGER_SERVER_SIDE': JSON.stringify('true'),
        })
      );
    } else {
      // Client-side plugins
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.LOGGER_CLIENT_SIDE': JSON.stringify('true'),
        })
      );
    }

    return config;
  },

  // Note: serverComponentsExternalPackages has been moved to serverExternalPackages
};

export default withBundleAnalyzer(nextConfig);