module.exports = {
  apps: [
    {
      name: 'waveclosers-backend',
      script: 'server/claude-proxy.js',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'waveclosers-worker',
      script: 'server/automationWorker.js',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
