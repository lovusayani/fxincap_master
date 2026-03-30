module.exports = {
  apps: [
    {
      name: "fxincap-trade",
      cwd: "/home/fxincaptrade/htdocs/trade.fxincap.com",
      script: "./dist/server/start.js",
      exec_mode: "cluster",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      watch: false,
      ignore_watch: ["node_modules", "dist"],
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
