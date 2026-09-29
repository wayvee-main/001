const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Metro's file cache opens thousands of entries concurrently for this graph on
// Windows, which repeatedly exhausts the process handle limit before a device
// can receive the bundle. The live graph still provides normal Fast Refresh;
// only the cross-restart disk cache is disabled on Windows.
if (process.platform === 'win32') {
  config.cacheStores = [];
}

module.exports = withNativeWind(config, { input: './src/global.css' });
