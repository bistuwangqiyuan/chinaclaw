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

编辑 `~/.chinaclaw/openclaw.json` 即可。完整配置参考 [chinaclaw.json.example](chinaclaw.json.example)。

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

## 基于 OpenClaw

Chinaclaw 是 OpenClaw 的 fork，保留所有原有功能。详见 [OpenClaw README](README.md)。
