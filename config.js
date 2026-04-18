let localConfig = {};
try {
  localConfig = require('./config.local');
} catch {
  localConfig = {};
}

module.exports = {
  // Add additional API keys here as needed.
  // Example: MY_KEY: process.env.MY_KEY || localConfig.MY_KEY || '',
};
