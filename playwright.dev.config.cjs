const config = require('./playwright.config.cjs');

// Exercise React's development-only Strict Mode checks with the same user flows.
module.exports = {
  ...config,
  use: { ...config.use, baseURL: 'http://127.0.0.1:5174' },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
};
