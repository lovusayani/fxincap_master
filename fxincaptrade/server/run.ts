import { createServer } from "./index";

const { server } = createServer();
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`App server on http://localhost:${port}`);
});
