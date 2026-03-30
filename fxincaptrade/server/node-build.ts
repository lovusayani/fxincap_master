import fs from "fs";
import path from "path";

export function createNodeBuild() {
  const serverEntry = path.join(__dirname, "index.ts");

  return `
import { createServer } from './index.js';
const { app, server } = createServer();
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(\`🚀 Server running on http://localhost:\${port}\`);
});
`;
}
