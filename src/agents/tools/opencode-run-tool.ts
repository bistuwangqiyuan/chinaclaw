/**
 * opencode_run tool: invoke the OpenCode CLI (https://opencode.ai) with a task.
 * Requires OpenCode to be installed (e.g. curl -fsSL https://opencode.ai/install | bash).
 * Use when the user wants to delegate coding tasks to OpenCode instead of ACP codex/subagent.
 */

import { spawn } from "node:child_process";
import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const OPENCODE_RUN_DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const OPENCODE_CLI = "opencode";

const OpencodeRunSchema = Type.Object({
  task: Type.String({ description: "Natural language task for OpenCode (e.g. build a static site)" }),
  cwd: Type.Optional(Type.String({ description: "Working directory; defaults to workspace root" })),
  timeoutSeconds: Type.Optional(
    Type.Number({ minimum: 10, maximum: 3600, description: "Max run time in seconds (default 300)" }),
  ),
});

export function createOpencodeRunTool(options?: { workspaceDir?: string }): AnyAgentTool {
  const defaultCwd = options?.workspaceDir?.trim() || process.cwd();

  return {
    label: "OpenCode",
    name: "opencode_run",
    description:
      "Run the OpenCode CLI with a coding task. OpenCode is an open-source AI coding agent (opencode.ai). Requires OpenCode to be installed on the host. Use for building sites, refactors, or script generation when the user asks for OpenCode by name.",
    parameters: OpencodeRunSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = readStringParam(params, "task", { required: true });
      const cwd = readStringParam(params, "cwd") || defaultCwd;
      const timeoutSeconds =
        typeof params.timeoutSeconds === "number" && Number.isFinite(params.timeoutSeconds)
          ? Math.max(10, Math.min(3600, Math.floor(params.timeoutSeconds)))
          : OPENCODE_RUN_DEFAULT_TIMEOUT_MS / 1000;
      const timeoutMs = timeoutSeconds * 1000;

      return new Promise<AgentToolResult<unknown>>((resolve) => {
        // opencode run "<task>" — non-interactive; CLI may use run subcommand or accept task as first arg
        const child = spawn(OPENCODE_CLI, ["run", task], {
          cwd,
          shell: true,
          timeout: timeoutMs,
          env: { ...process.env, CI: "1", OPENCODE_NON_INTERACTIVE: "1" },
        });

        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk: Buffer | string) => {
          stdout += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        });
        child.stderr?.on("data", (chunk: Buffer | string) => {
          stderr += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        });

        child.on("error", (err) => {
          const msg = err.message || String(err);
          if (msg.includes("ENOENT") || msg.includes("not found")) {
            resolve(
              jsonResult({
                status: "error",
                error:
                  "OpenCode CLI not found. Install it with: curl -fsSL https://opencode.ai/install | bash (see https://opencode.ai/docs/cli)",
              }),
            );
          } else {
            resolve(jsonResult({ status: "error", error: msg }));
          }
        });

        child.on("close", (code, signal) => {
          if (code === 0) {
            resolve(
              jsonResult({
                status: "ok",
                stdout: stdout.slice(-32_000),
                stderr: stderr.slice(-8_000),
              }),
            );
          } else {
            resolve(
              jsonResult({
                status: "error",
                exitCode: code ?? undefined,
                signal: signal ?? undefined,
                stdout: stdout.slice(-16_000),
                stderr: stderr.slice(-8_000),
                error: stderr.trim() || `opencode exited with code ${code}`,
              }),
            );
          }
        });
      });
    },
  };
}
