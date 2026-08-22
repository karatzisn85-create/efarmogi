const path = require('path');

/** Καθαρά modules που μοιράζονται Electron main + React renderer (χωρίς Node APIs). */
const SHARED_PUBLIC_MODULES = [
  path.resolve(__dirname, 'public/apologismosAppearance.js'),
  path.resolve(__dirname, 'app/core/subprojectCard.js'),
  path.resolve(__dirname, 'app/core/subprojectList.js'),
  path.resolve(__dirname, 'app/core/subprojectLifecycle.js'),
  path.resolve(__dirname, 'app/core/calendarDeadlines.js'),
  path.resolve(__dirname, 'app/core/prosklisiCatalog.js'),
  path.resolve(__dirname, 'app/core/entaxiCatalog.js'),
  path.resolve(__dirname, 'app/core/egkrisiCatalog.js'),
  path.resolve(__dirname, 'app/core/subprojectFiles.js'),
  path.resolve(__dirname, 'app/core/taskWorkspace.js'),
];

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Fallbacks για Node.js core modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "path": require.resolve("path-browserify"),
        "fs": false,
        "os": false,
        "crypto": false,
        "stream": false,
        "assert": false,
        "http": false,
        "https": false,
        "url": false,
        "buffer": false,
        "util": false
      };

      webpackConfig.target = 'web';

      // Επιτρέπουμε στοχευμένα imports από public/ για shared pure modules.
      const scopePlugin = (webpackConfig.resolve.plugins || []).find(
        (p) => p && p.constructor && p.constructor.name === 'ModuleScopePlugin'
      );
      if (scopePlugin && scopePlugin.allowedFiles) {
        for (const abs of SHARED_PUBLIC_MODULES) {
          scopePlugin.allowedFiles.add(abs);
        }
      }

      // Αγνόηση φακέλων build και dist από το file watching
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: ['**/node_modules', '**/build', '**/dist', '**/dedomena_ergon', '**/.git', '**/backup']
      };

      // Optimization για καλύτερη απόδοση build
      if (webpackConfig.optimization) {
        // Μείωση chunk size για να αποφύγουμε memory issues
        webpackConfig.optimization.splitChunks = {
          ...webpackConfig.optimization.splitChunks,
          maxSize: 244000, // 244KB max chunk size
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all'
            }
          }
        };
      }

      // Performance hints - μείωση warnings για μεγάλα bundles
      if (webpackConfig.performance) {
        webpackConfig.performance.maxAssetSize = 512000;
        webpackConfig.performance.maxEntrypointSize = 512000;
      }

      // Διόρθωση για global variable
      webpackConfig.plugins = webpackConfig.plugins || [];
      const webpack = require('webpack');
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          global: 'globalThis'
        })
      );

      return webpackConfig;
    },
  },
};
