# Chinaclaw — 中国可用的 AI 助手平台

Chinaclaw 是基于 [OpenClaw](https://github.com/openclaw/openclaw) 的中国化版本，专为中国境内用户设计，支持国内大模型 API，解决海外 AI 服务不可用问题。

## 特性

- **国内大模型优先**：DeepSeek、通义千问（DashScope）、智谱 GLM、Moonshot Kimi、火山引擎豆包
- **零配置启动**：`pnpm chinaclaw` 一键启动，自动创建配置
- **多 Provider 故障转移**：主模型失败时自动切换备用（fallbacks 链）
- **多 Key 轮换**：DeepSeek 支持 DEEPSEEK_API_KEY_1、_2 限流时自动切换

## 快速开始

```bash
# 1. 克隆仓库（需要 Node.js >= 22 + pnpm）
git clone https://github.com/bistuwangqiyuan/chinaclaw.git
cd chinaclaw

# 2. 安装依赖 + 构建
pnpm install && pnpm build

# 3. 设置 API Key（至少一个）
#    Windows:
set DEEPSEEK_API_KEY=sk-your-key-here
#    Linux/macOS:
export DEEPSEEK_API_KEY=sk-your-key-here

# 4. 启动（自动创建配置，自动启动 Gateway）
pnpm chinaclaw
```

仅需以上 4 步即可运行。首次启动自动在 `~/.chinaclaw/openclaw.json` 创建默认配置。

## 支持的国内模型

| 提供商 | 模型示例 | 环境变量 |
|--------|----------|----------|
| DeepSeek | deepseek-chat, deepseek-reasoner | `DEEPSEEK_API_KEY` |
| 通义千问 | qwen-max, qwen-plus, qwen-turbo | `DASHSCOPE_API_KEY` |
| 智谱 GLM | glm-4-plus | `ZAI_API_KEY` |
| Moonshot Kimi | kimi-k2.5 | `MOONSHOT_API_KEY` |
| 火山引擎豆包 | doubao-pro-32k | `VOLCANO_ENGINE_API_KEY` |

## 配置

首次运行 `pnpm chinaclaw` 会自动创建 `~/.chinaclaw/openclaw.json`，包含：
- Gateway 本地模式配置（`gateway.mode: "local"`）
- DeepSeek 和通义千问 Provider 定义
- 默认模型：`deepseek/deepseek-chat`，备选：`dashscope/qwen-max`
- Skills 白名单：coding-agent, discord, gemini, github, notion, obsidian, slack 等 26 项
- 搜索功能：默认使用 Kimi（需设置 `MOONSHOT_API_KEY`）

### 搜索功能

搜索使用 Kimi (Moonshot) 作为默认 provider。设置 `MOONSHOT_API_KEY` 后即可使用 `web_search` 工具：

```bash
# Windows:
set MOONSHOT_API_KEY=sk-your-moonshot-key
# Linux/macOS:
export MOONSHOT_API_KEY=sk-your-moonshot-key
```

也支持其他搜索 provider（Brave、Perplexity、Gemini、Grok），设置对应 API Key 即可。

### 自定义配置

编辑 `~/.chinaclaw/openclaw.json` 即可。完整配置参考 [chinaclaw.json.example](chinaclaw.json.example).

### 网关认证（解决「gateway token missing」）

若客户端提示 **unauthorized: gateway token missing** 或「已断开与网关的连接」：

- **新生成的配置**（首次运行 `pnpm chinaclaw` 后）已默认使用 `gateway.auth.mode: "none"`，本机连接无需 token。
- **已有配置**：在 `~/.chinaclaw/openclaw.json` 的 `gateway` 下增加 `"auth": { "mode": "none" }`，保存后重启网关即可免 token 连接。示例：
  ```json
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "auth": { "mode": "none" }
  }
  ```
- 若希望保留 token 认证：运行 `pnpm chinaclaw dashboard` 获取带 token 的 Control UI 地址，在浏览器打开该地址；或在 Control UI 设置中粘贴 token（token 可在 `pnpm chinaclaw config get gateway.auth.token` 查看，若网关曾自动生成并写入配置）。

**若提示「device signature invalid」或「已断开与网关的连接」**（多为客户端缓存了旧设备凭证）：
- 在 `gateway` 下增加 `"controlUi": { "dangerouslyDisableDeviceAuth": true }`，仅用于本机 loopback 时可关闭 Control UI 设备校验，避免旧 device token 导致拒绝连接。保存后重启网关。

### 永久设置环境变量

Windows (PowerShell):
```powershell
[Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", "sk-your-key", "User")
```

Linux/macOS:
```bash
echo 'export DEEPSEEK_API_KEY=sk-your-key' >> ~/.bashrc
source ~/.bashrc
```

## 命令参考

```bash
# 启动 Gateway（默认行为，无需参数）
pnpm chinaclaw

# 或直接用 node
node chinaclaw.mjs

# 指定端口
node chinaclaw.mjs gateway run --port 8080

# 使用 openclaw 子命令
node chinaclaw.mjs config list
node chinaclaw.mjs channels status
```

## 中国通讯软件支持

| 平台 | 扩展 ID | 配置方式 |
|------|---------|----------|
| **飞书/Lark** | `feishu` | 在[飞书开放平台](https://open.feishu.cn)创建机器人 |
| **钉钉** | `dingtalk` | 在[钉钉开放平台](https://open.dingtalk.com)创建机器人 |
| **企业微信** | `wecom` | 在[企业微信管理后台](https://work.weixin.qq.com)创建应用 |
| **微信** | `wechat` | 需运行外部 webhook bridge |

### 飞书 401 / api key invalid

若发消息或连接飞书时出现 **HTTP 401** 或 **Your api key is invalid**：

- **国内用户**：必须在 [open.feishu.cn](https://open.feishu.cn/app) 创建应用，并在配置中填写该应用的 **App ID** 与 **App Secret**；不要使用国际版 open.larksuite.com 的凭证。
- 确认未填错 App ID（形如 `cli_xxx`）、App Secret（在应用「凭证与基础信息」中复制）。
- 若使用国际版 Lark，请在飞书通道配置中设置 `domain: "lark"`，并使用 [open.larksuite.com](https://open.larksuite.com/app) 的应用凭证。

## 基于 OpenClaw

Chinaclaw 是 OpenClaw 的 fork，保留所有原有功能。详见 [OpenClaw README](README.md)。
