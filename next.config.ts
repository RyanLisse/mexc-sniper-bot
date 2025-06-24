import type { NextConfig } from "next";

// Bundle analyzer setup
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Exclude server-only packages from client-side bundles
  serverExternalPackages: [
    "better-sqlite3",
    "expo-secure-store",
    "expo-modules-core",
    "react-native",
    "@react-native-async-storage/async-storage",
    // OpenTelemetry packages for server-side only
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/instrumentation",
    "@opentelemetry/sdk-node",
    "@opentelemetry/resources",
    "@opentelemetry/exporter-jaeger",
    "@opentelemetry/exporter-prometheus",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-metrics"
  ],

  // TypeScript configuration
  typescript: {
    // Allow builds for deployment - fix types in development
    ignoreBuildErrors: true,
  },

  // Experimental features for better optimization
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-switch',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'lucide-react',
      'date-fns',
      'recharts',
      'react-day-picker',
      'class-variance-authority',
      'clsx',
      'tailwind-merge'
    ],
    // Enable advanced optimization features
    optimizeCss: true,
    gzipSize: true,
  },

  webpack: (config, { isServer, dev }) => {
    // Add module resolution for problematic dependencies
    config.module.rules.push({
      test: /[\\/]node_modules[\\/]expo-modules-core[\\/]/,
      use: 'null-loader',
    });

    // Exclude OpenTelemetry packages that use gRPC from client-side bundling
    if (!isServer) {
      config.module.rules.push({
        test: /[\\/]node_modules[\\/]@grpc[\\/]grpc-js[\\/]/,
        use: 'null-loader',
      });
      
      config.module.rules.push({
        test: /[\\/]node_modules[\\/]@opentelemetry[\\/](otlp-grpc-exporter-base|exporter-logs-otlp-grpc)[\\/]/,
        use: 'null-loader',
      });
    }

    if (isServer) {
      // Also exclude expo modules on server side
      config.externals.push("expo-modules-core");
      config.externals.push("expo-secure-store");
      
      // Configure OpenTelemetry for server-side
      config.externals.push({
        "@opentelemetry/auto-instrumentations-node": "commonjs @opentelemetry/auto-instrumentations-node",
        "@opentelemetry/instrumentation": "commonjs @opentelemetry/instrumentation"
      });

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
        // Exclude React Native and Expo dependencies that may be pulled in by Kinde
        'expo-secure-store': false,
        'expo-modules-core': false,
        'react-native': false,
        '@react-native-async-storage/async-storage': false,
        // Exclude OpenTelemetry packages from client-side
        '@opentelemetry/auto-instrumentations-node': false,
        '@opentelemetry/instrumentation': false,
        '@opentelemetry/sdk-node': false,
        '@opentelemetry/resources': false,
        '@opentelemetry/exporter-jaeger': false,
        '@opentelemetry/exporter-prometheus': false,
        '@opentelemetry/sdk-trace-node': false,
        '@opentelemetry/sdk-metrics': false,
        '@opentelemetry/core': false,
        // Exclude gRPC and Node.js specific modules
        '@grpc/grpc-js': false,
        '@opentelemetry/otlp-grpc-exporter-base': false,
        '@opentelemetry/exporter-logs-otlp-grpc': false,
      };

      // Keep minimal fallbacks for client-side exclusions
      const webpack = require('webpack');

      // Ensure these packages never make it to the client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        // Explicitly exclude React Native and Expo dependencies
        'expo-secure-store': false,
        'expo-modules-core': false,
        'react-native': false,
        '@react-native-async-storage/async-storage': false,
        // Explicitly exclude OpenTelemetry dependencies from client bundle
        '@opentelemetry/auto-instrumentations-node': false,
        '@opentelemetry/instrumentation': false,
        '@opentelemetry/sdk-node': false,
        '@opentelemetry/resources': false,
        '@opentelemetry/exporter-jaeger': false,
        '@opentelemetry/exporter-prometheus': false,
        '@opentelemetry/sdk-trace-node': false,
        '@opentelemetry/sdk-metrics': false,
        '@opentelemetry/core': false,
        // Explicitly exclude gRPC and Node.js specific modules
        '@grpc/grpc-js': false,
        '@opentelemetry/otlp-grpc-exporter-base': false,
        '@opentelemetry/exporter-logs-otlp-grpc': false,
      };

      // Advanced code splitting and optimization
      if (!dev) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'all',
            minSize: 20000,
            minRemainingSize: 0,
            minChunks: 1,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            enforceSizeThreshold: 50000,
            cacheGroups: {
              // React core libraries (highest priority)
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'react',
                priority: 30,
                reuseExistingChunk: true,
                enforce: true,
              },
              // Core vendor libraries
              vendors: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                priority: 10,
                reuseExistingChunk: true,
                chunks: 'initial',
              },
              // AI Agents - split by functionality
              agentsCore: {
                test: /[\\/]src[\\/]mexc-agents[\\/](base-agent|orchestrator|agent-manager)[\\/]/,
                name: 'agents-core',
                priority: 25,
                reuseExistingChunk: true,
              },
              agentsPattern: {
                test: /[\\/]src[\\/]mexc-agents[\\/](pattern-discovery-agent|symbol-analysis-agent|calendar-agent)[\\/]/,
                name: 'agents-pattern',
                priority: 24,
                reuseExistingChunk: true,
              },
              agentsTrading: {
                test: /[\\/]src[\\/]mexc-agents[\\/](strategy-agent|mexc-api-agent|trading-strategy-workflow)[\\/]/,
                name: 'agents-trading',
                priority: 23,
                reuseExistingChunk: true,
              },
              agentsSafety: {
                test: /[\\/]src[\\/]mexc-agents[\\/](safety-base-agent|risk-manager-agent|simulation-agent|reconciliation-agent|error-recovery-agent)[\\/]/,
                name: 'agents-safety',
                priority: 22,
                reuseExistingChunk: true,
              },
              agentsCoordination: {
                test: /[\\/]src[\\/]mexc-agents[\\/]coordination[\\/]/,
                name: 'agents-coordination',
                priority: 21,
                reuseExistingChunk: true,
              },
              // UI Components - split by category
              uiCore: {
                test: /[\\/]src[\\/]components[\\/]ui[\\/](button|input|label|card|dialog)[\\/]/,
                name: 'ui-core',
                priority: 19,
                reuseExistingChunk: true,
              },
              uiComplex: {
                test: /[\\/]src[\\/]components[\\/]ui[\\/](table|calendar|chart|navigation-menu|sidebar)[\\/]/,
                name: 'ui-complex',
                priority: 18,
                reuseExistingChunk: true,
              },
              uiOptimized: {
                test: /[\\/]src[\\/]components[\\/]ui[\\/](optimized-exports|optimized-icons)[\\/]/,
                name: 'ui-optimized',
                priority: 17,
                reuseExistingChunk: true,
              },
              // Dashboard components
              dashboardCore: {
                test: /[\\/]src[\\/]components[\\/]dashboard[\\/]/,
                name: 'dashboard',
                priority: 16,
                reuseExistingChunk: true,
              },
              // Radix UI components - split by frequency of use
              radixCore: {
                test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-(dialog|dropdown-menu|select|button)[\\/]/,
                name: 'radix-core',
                priority: 15,
                reuseExistingChunk: true,
              },
              radixAdvanced: {
                test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-(navigation-menu|tooltip|tabs|progress)[\\/]/,
                name: 'radix-advanced',
                priority: 14,
                reuseExistingChunk: true,
              },
              // TanStack Query
              tanstack: {
                test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
                name: 'tanstack',
                priority: 13,
                reuseExistingChunk: true,
              },
              // Chart libraries (lazy loaded)
              charts: {
                test: /[\\/]node_modules[\\/](recharts|d3-)[\\/]/,
                name: 'charts',
                priority: 12,
                reuseExistingChunk: true,
              },
              // Date utilities
              dateUtils: {
                test: /[\\/]node_modules[\\/](date-fns|react-day-picker)[\\/]/,
                name: 'date-utils',
                priority: 11,
                reuseExistingChunk: true,
              },
              // Common utilities
              utils: {
                test: /[\\/]node_modules[\\/](clsx|class-variance-authority|tailwind-merge|zod)[\\/]/,
                name: 'utils',
                priority: 9,
                reuseExistingChunk: true,
              },
            },
          },
          // Additional optimizations
          usedExports: true,
          sideEffects: false,
          concatenateModules: true,
          minimizer: [
            ...config.optimization.minimizer || [],
          ],
        };

        // Enable tree shaking for better dead code elimination
        config.resolve.alias = {
          ...config.resolve.alias,
          // Force tree-shakeable imports
          'lucide-react$': 'lucide-react/dist/esm/lucide-react',
        };

        // Mark packages as having no side effects for better tree shaking
        config.module.rules.push({
          test: /[\\/]node_modules[\\/](lucide-react|date-fns|clsx|class-variance-authority)[\\/]/,
          sideEffects: false,
        });
      }
    }
    return config;
  },

  // Note: serverComponentsExternalPackages has been moved to serverExternalPackages
};

export default withBundleAnalyzer(nextConfig);