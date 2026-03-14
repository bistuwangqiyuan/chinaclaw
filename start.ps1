# Chinaclaw one-click launcher (Windows PowerShell)
# Usage: .\start.ps1 [-Port 18789] [-NoBrowser] [-Rebuild]

param(
    [int]$Port = 18789,
    [switch]$NoBrowser,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

function Write-Step($msg) { Write-Host "[chinaclaw] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[chinaclaw] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[chinaclaw] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[chinaclaw] $msg" -ForegroundColor Red }

# --- 1. Load .env ---
if (Test-Path "$root\.env") {
    Get-Content "$root\.env" | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.+)$' -and $_.Trim() -notmatch '^\s*#') {
            $k = $matches[1]; $v = $matches[2].Trim()
            if (-not (Test-Path "Env:\$k") -or [string]::IsNullOrEmpty((Get-Item "Env:\$k" -ErrorAction SilentlyContinue).Value)) {
                Set-Item -Path "Env:\$k" -Value $v
            }
        }
    }
    Write-Step "Loaded .env"
} else {
    Write-Warn ".env not found - copy .env.example to .env and fill in your API keys"
}

$env:OPENCLAW_STATE_DIR = "$env:USERPROFILE\.chinaclaw"

# --- 2. Check Node.js ---
$nodeVer = $null
try { $nodeVer = (node -v 2>$null) } catch {}
if (-not $nodeVer) {
    Write-Err "Node.js not found. Install Node.js 22+ from https://nodejs.org"
    exit 1
}
Write-Step "Node.js $nodeVer"

# --- 3. Check pnpm ---
$pnpmVer = $null
try { $pnpmVer = (pnpm -v 2>$null) } catch {}
if (-not $pnpmVer) {
    Write-Step "pnpm not found, installing..."
    npm install -g pnpm
}

# --- 4. Install deps if needed ---
if (-not (Test-Path "$root\node_modules\.pnpm")) {
    Write-Step "Installing dependencies (first run, may take a few minutes)..."
    & pnpm install --no-frozen-lockfile --ignore-scripts 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "pnpm install failed"
        exit 1
    }
    Write-Ok "Dependencies installed"
}

# --- 5. Build if needed ---
$entryJs = "$root\dist\entry.js"
$needBuild = [bool]$Rebuild -or (-not (Test-Path $entryJs))

if (-not $needBuild -and (Test-Path $entryJs)) {
    $entryAge = (Get-Item $entryJs).LastWriteTime
    $newest = Get-ChildItem "$root\src" -Recurse -File -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newest -and $newest.LastWriteTime -gt $entryAge) {
        $needBuild = $true
    }
}

if ($needBuild) {
    Write-Step "Building project..."
    & node scripts/tsdown-build.mjs 2>$null
    & node scripts/copy-plugin-sdk-root-alias.mjs 2>$null
    & node --import tsx scripts/copy-hook-metadata.ts 2>$null
    & node --import tsx scripts/copy-export-html-templates.ts 2>$null
    & node --import tsx scripts/write-build-info.ts 2>$null
    & node --import tsx scripts/write-cli-startup-metadata.ts 2>$null
    & node --import tsx scripts/write-cli-compat.ts 2>$null
    if (-not (Test-Path $entryJs)) {
        Write-Err "Build failed - dist/entry.js not created"
        exit 1
    }
    Write-Ok "Build complete"
} else {
    Write-Step "Build is up to date"
}

# --- 6. Kill existing gateway on this port ---
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $existPid = $existing[0].OwningProcess
    Write-Step "Stopping existing gateway (PID $existPid) on port $Port..."
    & taskkill /PID $existPid /T /F 2>$null | Out-Null
    Start-Sleep -Seconds 2
}

# --- 7. Start gateway (use cmd.exe to invoke pnpm.cmd) ---
Write-Step "Starting OpenClaw gateway on port $Port..."
$proc = Start-Process cmd.exe -ArgumentList "/c pnpm openclaw gateway run --force --port $Port" -PassThru -WindowStyle Hidden
if (-not $proc) {
    Write-Err "Failed to start gateway process"
    exit 1
}

# --- 8. Wait for gateway to be ready ---
Write-Step "Waiting for gateway..."
$ready = $false
for ($i = 0; $i -lt 180; $i++) {
    Start-Sleep -Seconds 1
    $listen = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listen) {
        $ready = $true
        break
    }
    if ($proc.HasExited) {
        Write-Err "Gateway process exited unexpectedly (code $($proc.ExitCode))"
        exit 1
    }
}

if (-not $ready) {
    Write-Err "Gateway did not start within 3 minutes"
    exit 1
}

$url = "http://127.0.0.1:$Port"
Write-Ok "Gateway is running at $url"

# --- 9. Open browser ---
if (-not $NoBrowser) {
    Write-Step "Opening browser..."
    Start-Process $url
}

Write-Ok "Ready! Close this window or press Ctrl+C to stop."
Write-Host ""
Write-Host "  Control UI:  $url" -ForegroundColor White
Write-Host ""

try {
    $proc.WaitForExit()
} catch {
    $proc.Kill()
}
