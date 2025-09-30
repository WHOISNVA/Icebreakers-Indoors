const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Resolve Three.js conflicts by ensuring single instance
config.resolver.alias = {
  'three': require.resolve('three'),
};

// Dedupe Three.js to prevent multiple instances
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
