require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'fxincap-api',
      cwd: '/home/fxincapapi/htdocs/api.fxincap.com',
      script: 'node',
      args: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 7000,
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
        SENDGRID_FROM: process.env.SENDGRID_FROM
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 7000,
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
        SENDGRID_FROM: process.env.SENDGRID_FROM
      },
      // Restart policy
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '10s',
      // Logs
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Startup
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'logs', 'uploads']
    }
  ]
};
