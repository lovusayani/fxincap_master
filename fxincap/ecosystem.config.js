module.exports = {
  apps: [
    {
      name: 'fxincap-app',
      script: 'npm',
      args: 'start',
      cwd: '/home/fxincap/htdocs/fxincap.com',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        NEXT_PUBLIC_API_URL: 'https://fxincap.com',
        NEXT_PUBLIC_DASHBOARD_URL: 'https://fxincap.com'
      },
      error_file: '/home/fxincap/htdocs/fxincap.com/logs/err.log',
      out_file: '/home/fxincap/htdocs/fxincap.com/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', '.next', 'logs'],
      max_memory_restart: '500M'
    }
  ]
};
