#!/usr/bin/env node
/**
 * Cross-platform one-click Chinaclaw launcher.
 * Handles: .env loading, dep check, build, port cleanup, gateway start, browser open.
 *
 * Usage: node scripts/chinaclaw-oneclick.mjs [--port 18789] [--no-browser] [--rebuild]
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IS_WIN = os.platform() === "win32";

const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const PORT = portIdx !== -1 ? Number(args[portIdx + 1]) : 18789;
const NO_BROWSER = args.includes("--no-browser");
const REBUILD = args.includes("--rebuild");

const cyan = (s) => `\x1b[36m[chinaclaw] ${s}\x1b[0m`;
const green = (s) => `\x1b[32m[chinaclaw] ${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m[chinaclaw] ${s}\x1b[0m`;
const red = (s) => `\x1b[31m[chinaclaw] ${s}\x1b[0m`;

function step(msg) { console.log(cyan(msg)); }
function ok(msg) { console.log(green(msg)); }
function warn(msg) { console.log(yellow(msg)); }
function fail(msg) { console.error(red(msg)); process.exit(1); }

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: "pipe", encoding: "utf-8", shell: true, ...opts });
}

function runSafe(cmd) {
  try { run(cmd); } catch { /* non-critical */ }
}

// --- 1. Load .env ---
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
  step("Loaded .env");
} else {
  warn(".env not found — copy .env.example to .env and fill in your API keys");
}

process.env.OPENCLAW_STATE_DIR = path.join(os.homedir(), ".chinaclaw");

// --- 2. Check pnpm + install deps ---
const pnpmDir = path.join(ROOT, "node_modules", ".pnpm");
if (!fs.existsSync(pnpmDir)) {
  step("Installing dependencies (first run, may take a few minutes)...");
  try {
    run("pnpm install --no-frozen-lockfile --ignore-scripts", { stdio: "inherit" });
    ok("Dependencies installed");
  } catch {
    fail("pnpm install failed. Is pnpm installed? Run: npm install -g pnpm");
  }
}

// --- 3. Build if needed ---
const entryJs = path.join(ROOT, "dist", "entry.js");
let needBuild = REBUILD || !fs.existsSync(entryJs);

if (!needBuild) {
  const entryMtime = fs.statSync(entryJs).mtimeMs;
  const newestSrc = findNewestMtime(path.join(ROOT, "src"));
  if (newestSrc > entryMtime) needBuild = true;
}

if (needBuild) {
  step("Building project...");
  try { run("node scripts/tsdown-build.mjs"); } catch { fail("Core build (tsdown) failed"); }
  runSafe("node scripts/copy-plugin-sdk-root-alias.mjs");
  runSafe("node --import tsx scripts/copy-hook-metadata.ts");
  runSafe("node --import tsx scripts/copy-export-html-templates.ts");
  runSafe("node --import tsx scripts/write-build-info.ts");
  runSafe("node --import tsx scripts/write-cli-startup-metadata.ts");
  runSafe("node --import tsx scripts/write-cli-compat.ts");
  if (!fs.existsSync(entryJs)) fail("Build failed — dist/entry.js not created");
  ok("Build complete");
} else {
  step("Build is up to date");
}

// --- 4. Kill existing process on port ---
await killPortHolder(PORT);

// --- 5. Start gateway ---
step(`Starting OpenClaw gateway on port ${PORT}...`);

const gwCmd = IS_WIN ? "cmd" : "pnpm";
const gwArgs = IS_WIN
  ? ["/c", "pnpm", "openclaw", "gateway", "run", "--force", "--port", String(PORT)]
  : ["openclaw", "gateway", "run", "--force", "--port", String(PORT)];

const gw = spawn(gwCmd, gwArgs, {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

gw.on("error", (err) => fail(`Failed to start gateway: ${err.message}`));

// --- 6. Wait for gateway (needs extra time on first run due to internal UI build) ---
step("Waiting for gateway...");
const ready = await waitForPort(PORT, 180);

if (!ready) fail("Gateway did not start within 3 minutes");

const url = `http://127.0.0.1:${PORT}`;
ok(`Gateway is running at ${url} (PID ${gw.pid})`);
console.log(`\n  Control UI:  ${url}\n`);

// --- 7. Open browser ---
if (!NO_BROWSER) {
  step("Opening browser...");
  try {
    if (IS_WIN) run(`start "" "${url}"`);
    else if (os.platform() === "darwin") run(`open "${url}"`);
    else run(`xdg-open "${url}" 2>/dev/null || true`);
  } catch { /* best-effort */ }
}

ok("Ready! Press Ctrl+C to stop.");

const shutdown = () => { gw.kill(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep process alive — gw.on('exit') handles natural exit
gw.on("exit", (code) => {
  if (code !== null && code !== 0) console.error(red(`Gateway exited with code ${code}`));
  process.exit(code ?? 0);
});

// --- Helpers ---

function waitForPort(port, timeoutSec) {
  return new Promise((resolve) => {
    let elapsed = 0;
    const check = () => {
      const sock = new net.Socket();
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => {
        sock.destroy();
        elapsed++;
        if (elapsed >= timeoutSec) resolve(false);
        else setTimeout(check, 1000);
      });
      sock.connect(port, "127.0.0.1");
    };
    check();
  });
}

function findNewestMtime(dir) {
  let newest = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        newest = Math.max(newest, findNewestMtime(full));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        newest = Math.max(newest, fs.statSync(full).mtimeMs);
      }
    }
  } catch { /* ignore */ }
  return newest;
}

async function killPortHolder(port) {
  try {
    if (IS_WIN) {
      const out = run(`netstat -ano | findstr ":${port}.*LISTENING"`).trim();
      if (out) {
        const pid = out.split(/\s+/).pop();
        if (pid && pid !== "0") {
          step(`Stopping existing process (PID ${pid}) on port ${port}...`);
          run(`taskkill /PID ${pid} /T /F`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } else {
      const pid = run(`lsof -ti :${port} 2>/dev/null || true`).trim();
      if (pid) {
        step(`Stopping existing process (PID ${pid}) on port ${port}...`);
        run(`kill -9 ${pid} 2>/dev/null || true`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } catch { /* no existing process */ }
}
