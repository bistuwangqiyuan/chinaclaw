import type { PluginRuntime } from "openclaw/plugin-sdk/wecom";

let runtime: PluginRuntime | null = null;

export function setWecomRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getWecomRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeCom runtime not initialized - plugin not registered");
  }
  return runtime;
}
