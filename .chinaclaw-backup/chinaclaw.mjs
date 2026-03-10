#!/usr/bin/env node

// Chinaclaw: China-focused fork of OpenClaw
// Sets CHINACLAW=1 so config uses ~/.chinaclaw/chinaclaw.json
process.env.CHINACLAW = "1";

await import("./openclaw.mjs");
