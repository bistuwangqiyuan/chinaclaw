import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wechat";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/wechat";
import { wechatPlugin } from "./src/channel.js";
import { setWechatRuntime } from "./src/runtime.js";

const plugin = {
  id: "wechat",
  name: "WeChat",
  description: "WeChat (微信) channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWechatRuntime(api.runtime);
    api.registerChannel({ plugin: wechatPlugin });
  },
};

export default plugin;
