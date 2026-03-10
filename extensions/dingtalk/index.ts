import type { OpenClawPluginApi } from "openclaw/plugin-sdk/dingtalk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/dingtalk";
import { dingtalkPlugin } from "./src/channel.js";
import { setDingtalkRuntime } from "./src/runtime.js";

const plugin = {
  id: "dingtalk",
  name: "DingTalk",
  description: "DingTalk (钉钉) channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setDingtalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin });
  },
};

export default plugin;
