/**
 * GitHub push webhook → deploy-prod.sh
 * Production is usually exposed as https://fxincap.com/hooks/deploy (nginx → this process on DEPLOY_PORT).
 * Path must match DEPLOY_PATH (default /hooks/deploy). Do not add a second endpoint; reuse the existing GitHub webhook.
 */
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");
const path = require("path");

const port = Number(process.env.DEPLOY_PORT || 9010);
const routePath = process.env.DEPLOY_PATH || "/hooks/deploy";
const repoBaseDir = process.cwd();
const deployScript = process.env.DEPLOY_SCRIPT || path.join(repoBaseDir, "deploy-prod.sh");
const webhookSecret = process.env.DEPLOY_WEBHOOK_SECRET || "";
const deployBranch = process.env.DEPLOY_BRANCH || "dev";

let isDeployRunning = false;

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function verifySignature(rawBody, signatureHeader) {
  if (!webhookSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = `sha256=${crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex")}`;
  const sigA = Buffer.from(expected, "utf8");
  const sigB = Buffer.from(signatureHeader, "utf8");
  if (sigA.length !== sigB.length) return false;
  return crypto.timingSafeEqual(sigA, sigB);
}

function shouldDeploy(payload) {
  const ref = payload && typeof payload.ref === "string" ? payload.ref : "";
  const expectedRef = `refs/heads/${deployBranch}`;
  return ref === expectedRef;
}

function runDeploy() {
  isDeployRunning = true;
  const child = spawn("bash", [deployScript], {
    cwd: repoBaseDir,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    isDeployRunning = false;
    console.log(`[webhook] deploy finished with exit code ${code}`);
  });

  child.on("error", (err) => {
    isDeployRunning = false;
    console.error("[webhook] failed to start deploy:", err);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    return json(res, 200, { ok: true, running: isDeployRunning });
  }

  if (req.method !== "POST" || req.url !== routePath) {
    return json(res, 404, { ok: false, error: "not_found" });
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const rawBody = Buffer.concat(chunks);
      const signature = req.headers["x-hub-signature-256"];
      if (!verifySignature(rawBody, Array.isArray(signature) ? signature[0] : signature)) {
        return json(res, 401, { ok: false, error: "invalid_signature" });
      }

      const event = req.headers["x-github-event"];
      if (event !== "push") {
        return json(res, 202, { ok: true, skipped: "event_not_push" });
      }

      let payload = {};
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch (err) {
        return json(res, 400, { ok: false, error: "invalid_json" });
      }

      if (!shouldDeploy(payload)) {
        return json(res, 202, { ok: true, skipped: "branch_mismatch" });
      }

      if (isDeployRunning) {
        return json(res, 202, { ok: true, skipped: "deploy_in_progress" });
      }

      runDeploy();
      return json(res, 202, { ok: true, started: true });
    } catch (err) {
      console.error("[webhook] unhandled request error:", err);
      return json(res, 500, { ok: false, error: "internal_error" });
    }
  });
});

server.listen(port, () => {
  console.log(`[webhook] listening on ${port}${routePath}`);
  if (!webhookSecret) {
    console.warn("[webhook] DEPLOY_WEBHOOK_SECRET is empty; all webhook requests will be rejected");
  }
});
