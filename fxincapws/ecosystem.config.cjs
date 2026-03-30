module.exports = {
  apps: [
    {
      name: "fxincap-ws",
      script: "src/server.js",
      cwd: "/home/fxincapws/htdocs/ws.fxincap.com",
      instances: 1,
      exec_mode: "fork",
      env: {
        WS_PORT: 4040,
        ADMIN_TOKEN: "changeme-admin-token",
        DB_HOST: "forex-final-db-do-user-23389554-0.m.db.ondigitalocean.com",
        DB_PORT: 25060,
        DB_USER: "suimfx1",
        DB_PASS: process.env.DB_PASS || "",
        DB_NAME: "suim_fx",
        DB_SSL: "REQUIRED",
        FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || "",
      },
    },
  ],
};
