// Start the server in this container, hit /api/health, exit with its verdict.
//
// Run by deploy.sh against a freshly built image BEFORE it replaces the live
// one. A 200 or a 503 both prove the module graph loaded and the server
// answers; a crash on startup (the Turbopack externals bug) never reaches the
// health check and fails the deploy here instead of in production.
import { spawn } from "node:child_process";

const server = spawn("node", ["server.js"], { stdio: "inherit" });
const deadline = Date.now() + 30_000;

const probe = async () => {
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:3000/api/health");
      const body = await res.json();
      console.log(`smoke: /api/health ${res.status} build=${body.build} status=${body.status}`);
      return body.build;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("smoke: server did not answer /api/health within 30s");
};

try {
  const build = await probe();
  const expected = (process.env.BUILD_COMMIT ?? "").slice(0, 7);
  if (expected && build !== expected) {
    throw new Error(`smoke: image reports build ${build}, expected ${expected}`);
  }
  process.exitCode = 0;
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
