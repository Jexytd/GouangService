// ==============================================================================
// PM2 Ecosystem Configuration for Ricoh Shield Headless API
// ==============================================================================

module.exports = {
  apps: [
    {
      name: 'ricoh-shield-api',
      script: './index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 8000
    }
  ]
};
