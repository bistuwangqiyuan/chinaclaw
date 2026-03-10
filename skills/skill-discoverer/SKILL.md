---
name: skill-discoverer
description: Search for and evaluate new skills that could help the agent. Use when user asks to "find new skills", "what else can you do", or during periodic self-improvement. Read-only discovery — never auto-installs, always asks user first.
metadata: { "openclaw": { "emoji": "🔍", "requires": { "anyBins": ["clawhub", "curl"] } } }
---

# Skill Discoverer

Find, evaluate, and recommend useful skills based on the agent's usage patterns and user needs.

## When to Trigger

- User asks "find new skills", "what can you learn", "discover capabilities"
- During heartbeat self-improvement cycle
- After encountering a task the agent couldn't handle well

## Safety Boundaries

**This skill is strictly read-only for discovery.**

- Search skill registries (clawhub, GitHub)
- Evaluate skill descriptions and requirements
- Present recommendations to the user
- **NEVER auto-install** — always wait for explicit user approval
- **NEVER execute** skill scripts during discovery
- **NEVER download** files without user consent

## Discovery Process

### Step 1: Analyze Needs

Review recent interactions to identify:
- Tasks the agent struggled with
- Repeated manual work that could be automated
- Tools or integrations the user frequently mentions
- Gaps in current skill coverage

### Step 2: Search

If `clawhub` is available:
```bash
clawhub search "<keyword>"
```

Alternatively, check the OpenClaw skills documentation for built-in options.

### Step 3: Evaluate

For each discovered skill, assess:

| Criterion | Check |
|-----------|-------|
| **Relevance** | Does it address a real need? |
| **Safety** | Does it require elevated permissions? |
| **Dependencies** | What binaries/APIs does it need? |
| **Maintenance** | Is it actively maintained? |
| **Overlap** | Does it duplicate existing skills? |

### Step 4: Recommend

Present findings in this format:

```markdown
## Skill Recommendations

### [Skill Name] ⭐⭐⭐⭐⭐
- **What it does:** [brief description]
- **Why you might want it:** [based on observed needs]
- **Requirements:** [dependencies]
- **Install:** `clawhub install <name>` (requires your approval)

### [Skill Name] ⭐⭐⭐
- ...
```

Rate relevance with 1-5 stars. Sort by relevance.

### Step 5: Wait for User Decision

After presenting recommendations:
- Wait for the user to choose which (if any) to install
- Only proceed with installation after explicit "yes" / "install it" / approval
- If the user says no, respect the decision and note it for future reference

## Skill Categories to Watch

| Category | Examples | When Useful |
|----------|----------|-------------|
| **Productivity** | notion, obsidian, trello | Note-taking, project management |
| **Communication** | slack, discord, himalaya | Messaging integration |
| **Development** | coding-agent, github, gh-issues | Code and repo management |
| **Media** | nano-pdf, gifgrep, summarize | Content processing |
| **System** | eightctl, healthcheck | System monitoring |
| **Search** | sag, xurl | Information retrieval |
