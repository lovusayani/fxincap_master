module.exports = {
  apps: [
    {
      name: "fxincap-admin",
      cwd: "/home/fxincapadmin/htdocs/admin.fxincap.com",
      script: "bash",
      args: "-c 'npm run start:prod'",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 5001,
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
