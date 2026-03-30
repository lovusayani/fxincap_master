import { createServer } from "./index";

const port = process.env.PORT || 3000;

const serverInstance = createServer();
const { app, server } = serverInstance;

if (!server) {
  console.error("Failed to create server");
  process.exit(1);
}

server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📦 Domain: https://trade.suimfx.world`);
});
