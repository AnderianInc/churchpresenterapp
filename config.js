let localConfig = {};
try {
  localConfig = require('./config.local');
} catch {
  localConfig = {};
}

module.exports = {
  YOUVERSION_APP_KEY: process.env.YOUVERSION_APP_KEY || process.env.YV_APP_KEY || localConfig.YOUVERSION_APP_KEY || '',
  // Add additional API keys here as needed.
};
