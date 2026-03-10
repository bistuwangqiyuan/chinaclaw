import type { PluginRuntime } from "openclaw/plugin-sdk/dingtalk";

let runtime: PluginRuntime | null = null;

export function setDingtalkRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getDingtalkRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("DingTalk runtime not initialized - plugin not registered");
  }
  return runtime;
}
