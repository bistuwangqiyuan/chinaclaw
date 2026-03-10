#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.CHINACLAW = "1";

const CHINACLAW_DIR = path.join(os.homedir(), ".chinaclaw");
process.env.OPENCLAW_STATE_DIR = CHINACLAW_DIR;

const CONFIG_PATH = path.join(CHINACLAW_DIR, "openclaw.json");

if (!fs.existsSync(CONFIG_PATH)) {
  fs.mkdirSync(CHINACLAW_DIR, { recursive: true });

  const providers = {};

  providers.deepseek = {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "DEEPSEEK_API_KEY",
    api: "openai-completions",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", reasoning: false },
      { id: "deepseek-reasoner", name: "DeepSeek R1", reasoning: true },
    ],
  };

  providers.dashscope = {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "DASHSCOPE_API_KEY",
    api: "openai-completions",
    models: [
      { id: "qwen-max", name: "Qwen Max", reasoning: false },
      { id: "qwen-plus", name: "Qwen Plus", reasoning: false },
      { id: "qwen-turbo", name: "Qwen Turbo", reasoning: false },
    ],
  };

  const config = {
    gateway: { mode: "local", bind: "loopback" },
    agents: {
      defaults: {
        model: {
          primary: "deepseek/deepseek-chat",
          fallbacks: ["dashscope/qwen-max"],
        },
      },
    },
    models: { mode: "merge", providers },
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasDashScope = Boolean(process.env.DASHSCOPE_API_KEY);

  process.stderr.write(`[chinaclaw] Config created: ${CONFIG_PATH}\n`);

  if (!hasDeepSeek && !hasDashScope) {
    process.stderr.write(
      `[chinaclaw] No API key detected. Set at least one before using models:\n` +
        `  set DEEPSEEK_API_KEY=sk-xxx   (Windows)\n` +
        `  export DEEPSEEK_API_KEY=sk-xxx (Linux/macOS)\n`,
    );
  }
}

// Default to "gateway run --force" when no subcommand is given
const userArgs = process.argv.slice(2);
if (userArgs.length === 0) {
  process.argv = [...process.argv.slice(0, 2), "gateway", "run", "--force"];
}

await import("./openclaw.mjs");
