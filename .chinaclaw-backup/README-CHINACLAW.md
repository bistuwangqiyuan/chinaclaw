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

## 基于 OpenClaw

Chinaclaw 是 OpenClaw 的 fork，保留所有原有功能。详见 [OpenClaw README](README.md)。
