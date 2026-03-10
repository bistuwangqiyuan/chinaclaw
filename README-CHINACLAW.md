# Chinaclaw — 中国可用的 AI 助手平台

Chinaclaw 是基于 [OpenClaw](https://github.com/openclaw/openclaw) 的中国化版本，专为中国境内用户设计，支持国内大模型 API，解决海外 AI 服务不可用问题。

## 特性

- **国内大模型优先**：DeepSeek、通义千问（DashScope）、智谱 GLM、Moonshot Kimi、火山引擎豆包
- **配置目录**：`~/.chinaclaw/chinaclaw.json`（兼容 openclaw.json 格式）
- **一键中国化配置**：`chinaclaw onboard --china` 默认 DeepSeek，使用 ~/.chinaclaw/
- **多 Provider 故障转移**：主模型失败时自动切换备用（fallbacks 链）
- **多 Key 轮换**：DeepSeek 支持 DEEPSEEK_API_KEY_1、_2 限流时自动切换

## 安装

```bash
# 需要 Node.js ≥ 22
pnpm install
pnpm build
```

## 使用

```bash
# 中国化一键配置（默认 DeepSeek，配置 ~/.chinaclaw/）
chinaclaw onboard --china

# 非交互式配置
chinaclaw onboard --china --non-interactive --accept-risk --auth-choice deepseek-api-key --deepseek-api-key "sk-xxx"

# 启动 Gateway
chinaclaw gateway --port 18789 --verbose

# 或使用 openclaw 命令（使用 ~/.openclaw/ 配置）
openclaw onboard
```

## 支持的国内模型

| 提供商 | 模型示例 | 认证方式 |
|--------|----------|----------|
| DeepSeek | deepseek-chat, deepseek-reasoner | `chinaclaw onboard --auth-choice deepseek-api-key` |
| 通义千问 | qwen-max, qwen-plus, qwen-turbo | `--auth-choice dashscope-api-key` |
| 智谱 GLM | glm-4-plus | `--auth-choice zai-api-key` |
| Moonshot Kimi | kimi-k2.5 | `--auth-choice moonshot-api-key` |

## 环境变量

| 变量 | 说明 |
|------|------|
| CHINACLAW=1 | 启用 Chinaclaw 模式（chinaclaw 命令自动设置） |
| CHINACLAW_STATE_DIR | 配置目录路径 |
| CHINACLAW_HOME | 用户主目录（用于 ~/.chinaclaw） |
| CHINACLAW_CONFIG_PATH | 配置文件路径 |
| DEEPSEEK_API_KEY | DeepSeek API 密钥 |
| DEEPSEEK_API_KEY_1, _2 | 多 Key 轮换 |
| DASHSCOPE_API_KEY | 通义千问 API 密钥 |

## 配置示例

参见 [chinaclaw.json.example](chinaclaw.json.example)。完整中文部署指南见 [docs/zh-CN/chinaclaw-deploy.md](docs/zh-CN/chinaclaw-deploy.md)。

## OpenCode 能力

Chinaclaw 内置两种 OpenCode 相关能力：

### 1. OpenCode Zen（模型 API）

- **用途**：在 OpenClaw 中直接使用 OpenCode Zen 提供的编程向模型（Claude Opus、GPT Codex、Gemini 等）。
- **配置**：`openclaw onboard` 或 `chinaclaw onboard` 时选择认证方式 **opencode-zen**，或设置环境变量 `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`。
- **模型引用**：例如 `opencode/claude-opus-4-6`、`opencode/gpt-5.1-codex`。详见 [OpenCode Zen](https://opencode.ai/zen)。

### 2. OpenCode CLI（opencode_run 工具）

- **用途**：通过工具 `opencode_run` 调用本机安装的 [OpenCode CLI](https://opencode.ai/docs/cli) 执行编程任务（建站、重构、脚本生成等）。
- **安装 OpenCode CLI**：
  ```bash
  curl -fsSL https://opencode.ai/install | bash
  ```
- **使用**：在对话中让助手「用 OpenCode 做……」或直接调用 `opencode_run`，传入 `task`（自然语言任务描述）及可选的 `cwd`、`timeoutSeconds`。
- **说明**：需在运行 OpenClaw Gateway 的机器上安装 OpenCode；未安装时工具会返回安装指引。

## 中国通讯软件支持

Chinaclaw 新增对主流中国通讯平台的支持，可在 OpenClaw 中直接接收和回复来自这些平台的消息：

| 平台 | 扩展 ID | 状态 | 配置方式 |
|------|---------|------|----------|
| **飞书/Lark** | `feishu` | 已内置 | 在[飞书开放平台](https://open.feishu.cn)创建机器人，配置 appId/appSecret |
| **钉钉** | `dingtalk` | 已内置 | 在[钉钉开放平台](https://open.dingtalk.com)创建机器人，配置 appKey/appSecret/robotCode |
| **企业微信** | `wecom` | 已内置 | 在[企业微信管理后台](https://work.weixin.qq.com)创建应用，配置 corpId/agentId/secret/token/encodingAESKey |
| **微信** | `wechat` | 已内置 (bridge) | 需运行外部 webhook bridge（如 [wechaty](https://github.com/wechaty/wechaty)），配置 bridgeSendUrl |

### 配置示例

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "channels": {
    "dingtalk": {
      "appKey": "your-app-key",
      "appSecret": "your-app-secret",
      "robotCode": "your-robot-code",
      "dmPolicy": "open"
    },
    "wecom": {
      "corpId": "your-corp-id",
      "agentId": "1000002",
      "secret": "your-secret",
      "token": "your-callback-token",
      "encodingAESKey": "your-encoding-aes-key",
      "dmPolicy": "open"
    },
    "wechat": {
      "bridgeSendUrl": "http://localhost:8080/send",
      "webhookSecret": "your-secret",
      "dmPolicy": "open"
    }
  },
  "plugins": {
    "entries": {
      "feishu": { "enabled": true },
      "dingtalk": { "enabled": true },
      "wecom": { "enabled": true },
      "wechat": { "enabled": true }
    }
  }
}
```

### Webhook 端点

启动 gateway 后，以下 webhook 端点自动注册：

| 平台 | Webhook URL | 用途 |
|------|------------|------|
| 钉钉 | `http://your-host:18789/webhook/dingtalk` | 机器人回调地址 |
| 企业微信 | `http://your-host:18789/webhook/wecom` | 应用回调 URL |
| 微信 | `http://your-host:18789/webhook/wechat` | Bridge 转发目标 |

### 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `DINGTALK_APP_KEY` | 钉钉应用 appKey |
| `DINGTALK_APP_SECRET` | 钉钉应用 appSecret |
| `DINGTALK_ROBOT_CODE` | 钉钉机器人 robotCode |
| `WECOM_CORP_ID` | 企业微信企业 ID |
| `WECOM_AGENT_ID` | 企业微信应用 agentId |
| `WECOM_SECRET` | 企业微信应用 secret |
| `WECOM_TOKEN` | 企业微信回调 token |
| `WECOM_ENCODING_AES_KEY` | 企业微信回调 EncodingAESKey |
| `WECHAT_BRIDGE_SEND_URL` | 微信 bridge 发送端点 |
| `WECHAT_WEBHOOK_SECRET` | 微信 webhook 密钥 |

## 自我优化 Skills

已安装可让 OpenClaw 持续自我优化的 Skills 与模板，**无安全风险**（不自动安装第三方代码、不执行任意命令）：

| 组件 | 位置 | 说明 |
|------|------|------|
| **self-improvement** | `~/.openclaw/skills/self-improvement/` | 指导 Agent 定期维护记忆、回顾会话、发现 Skills；仅搜索不自动安装 |
| **clawhub** | 内置 | 搜索/安装/更新 ClawHub 上的 Skills；需先 `npm i -g clawhub` |
| **session-logs** | 内置 | 分析历史会话 JSONL（需 `jq`、`rg`） |
| **skill-creator** | 内置 | 创建/迭代 Skills |
| **HEARTBEAT 模板** | `memory/` + `HEARTBEAT.md` | 心跳时执行自我维护：更新 MEMORY.md、搜索新 Skills 并建议 |

**安全边界**：`clawhub install` 仅在用户明确要求时执行；`self-improvement` 仅读写工作区文件。

**session-logs 依赖**（Windows 可选）：`choco install jq ripgrep` 或 `scoop install jq ripgrep`。

## 基于 OpenClaw

Chinaclaw 是 OpenClaw 的 fork，保留所有原有功能。详见 [OpenClaw README](README.md)。
