#!/usr/bin/env bash
# Chinaclaw one-click launcher (Linux / macOS)
# Usage: ./start.sh [--port 18789] [--no-browser] [--rebuild]
set -euo pipefail

PORT=18789
NO_BROWSER=0
REBUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)       PORT="$2"; shift 2 ;;
    --no-browser) NO_BROWSER=1; shift ;;
    --rebuild)    REBUILD=1; shift ;;
    *) echo "[chinaclaw] Unknown option: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

step()  { printf '\033[36m[chinaclaw] %s\033[0m\n' "$*"; }
ok()    { printf '\033[32m[chinaclaw] %s\033[0m\n' "$*"; }
warn()  { printf '\033[33m[chinaclaw] %s\033[0m\n' "$*"; }
err()   { printf '\033[31m[chinaclaw] %s\033[0m\n' "$*"; }

# --- 1. Load .env ---
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
  step "Loaded .env"
else
  warn ".env not found — copy .env.example to .env and fill in your API keys"
fi

export OPENCLAW_STATE_DIR="$HOME/.chinaclaw"

# --- 2. Check Node.js ---
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js 22+ from https://nodejs.org"
  exit 1
fi
step "Node.js $(node -v)"

# --- 3. Check pnpm ---
if ! command -v pnpm &>/dev/null; then
  step "pnpm not found, installing..."
  npm install -g pnpm
fi

# --- 4. Install deps if needed ---
if [[ ! -d "$ROOT/node_modules/.pnpm" ]]; then
  step "Installing dependencies (first run, may take a few minutes)..."
  pnpm install --no-frozen-lockfile --ignore-scripts || { err "pnpm install failed"; exit 1; }
  ok "Dependencies installed"
fi

# --- 5. Build if needed ---
ENTRY="$ROOT/dist/entry.js"
NEED_BUILD=$REBUILD

[[ $NEED_BUILD -eq 0 && ! -f "$ENTRY" ]] && NEED_BUILD=1

if [[ $NEED_BUILD -eq 0 && -f "$ENTRY" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    NEWEST_SRC="$(find "$ROOT/src" \( -name '*.ts' -o -name '*.tsx' \) -exec stat -f '%m' {} + 2>/dev/null | sort -rn | head -1 || echo 0)"
    ENTRY_MTIME="$(stat -f '%m' "$ENTRY" 2>/dev/null || echo 0)"
  else
    NEWEST_SRC="$(find "$ROOT/src" \( -name '*.ts' -o -name '*.tsx' \) -exec stat -c '%Y' {} + 2>/dev/null | sort -rn | head -1 || echo 0)"
    ENTRY_MTIME="$(stat -c '%Y' "$ENTRY" 2>/dev/null || echo 0)"
  fi
  [[ "$NEWEST_SRC" -gt "$ENTRY_MTIME" ]] && NEED_BUILD=1
fi

if [[ $NEED_BUILD -eq 1 ]]; then
  step "Building project..."
  node scripts/tsdown-build.mjs 2>/dev/null
  node scripts/copy-plugin-sdk-root-alias.mjs 2>/dev/null
  node --import tsx scripts/copy-hook-metadata.ts 2>/dev/null || true
  node --import tsx scripts/copy-export-html-templates.ts 2>/dev/null || true
  node --import tsx scripts/write-build-info.ts 2>/dev/null || true
  node --import tsx scripts/write-cli-startup-metadata.ts 2>/dev/null || true
  node --import tsx scripts/write-cli-compat.ts 2>/dev/null || true
  [[ ! -f "$ENTRY" ]] && { err "Build failed — dist/entry.js not created"; exit 1; }
  ok "Build complete"
else
  step "Build is up to date"
fi

# --- 6. Kill existing gateway on this port ---
EXISTING_PID="$(lsof -ti :"$PORT" 2>/dev/null || true)"
if [[ -n "$EXISTING_PID" ]]; then
  step "Stopping existing gateway (PID $EXISTING_PID) on port $PORT..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

# --- 7. Start gateway ---
step "Starting OpenClaw gateway on port $PORT..."
pnpm openclaw gateway run --force --port "$PORT" &
GW_PID=$!

# --- 8. Wait for gateway to be ready ---
step "Waiting for gateway..."
READY=0
for _ in $(seq 1 60); do
  sleep 1
  if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
    READY=1
    break
  fi
  kill -0 $GW_PID 2>/dev/null || { err "Gateway process exited unexpectedly"; exit 1; }
done

[[ $READY -eq 0 ]] && { err "Gateway did not start within 60 seconds"; exit 1; }

URL="http://127.0.0.1:$PORT"
ok "Gateway is running at $URL (PID $GW_PID)"
echo ""
echo "  Control UI:  $URL"
echo ""

# --- 9. Open browser ---
if [[ $NO_BROWSER -eq 0 ]]; then
  step "Opening browser..."
  if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" 2>/dev/null &
  elif command -v open &>/dev/null; then
    open "$URL"
  fi
fi

ok "Ready! Press Ctrl+C to stop."

cleanup() { kill $GW_PID 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait $GW_PID 2>/dev/null || true
