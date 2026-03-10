---
name: self-improvement
description: Guide the agent to periodically review sessions, distill learnings into MEMORY.md, prune outdated knowledge, and discover useful skills. Use during heartbeat or when user asks to "improve yourself" or "review what you learned". Safe boundaries — only reads/writes workspace files, never auto-installs code.
metadata: { "openclaw": { "emoji": "🧠", "always": true } }
---

# Self-Improvement

Periodically maintain and evolve the agent's knowledge and capabilities through safe, bounded operations.

## When to Trigger

- During heartbeat cycles
- When user asks to "improve yourself", "review learnings", "optimize", "evolve"
- After completing a long or complex task

## Safety Boundaries

**ALLOWED:**
- Read session logs (`~/.openclaw/agents/<agentId>/sessions/*.jsonl`)
- Read and write `MEMORY.md` in the workspace
- Read and write `memory/YYYY-MM-DD.md` daily log files
- Search for skills via `clawhub search` (read-only)
- Suggest improvements to the user

**NEVER DO:**
- Auto-install skills, packages, or dependencies without explicit user approval
- Execute arbitrary shell commands
- Modify system configuration files
- Delete user data or session logs
- Make network requests beyond skill search
- Change API keys or authentication settings

## Improvement Cycle

### Step 1: Review Recent Activity

Read the latest `memory/YYYY-MM-DD.md` files (last 3-7 days). Look for:
- Repeated questions or confusion points
- Successful problem-solving patterns
- Tool usage that worked well or poorly
- User preferences discovered during conversations

### Step 2: Distill Learnings

Update `MEMORY.md` with distilled insights:

```markdown
## Learnings

### User Preferences
- [preference discovered from sessions]

### Effective Patterns
- [pattern that worked well]

### Known Pitfalls
- [common mistakes to avoid]
```

Keep `MEMORY.md` concise (under 200 lines). Remove outdated or superseded entries.

### Step 3: Prune Stale Knowledge

Review `MEMORY.md` for entries that are:
- More than 30 days old and no longer relevant
- Contradicted by newer learnings
- Redundant (merge duplicates)

### Step 4: Skill Discovery (Optional)

If `clawhub` is available:
1. Run `clawhub search` for skills related to recent user needs
2. Present findings to user as suggestions
3. **Wait for explicit user approval** before any installation

### Step 5: Report

Summarize what was reviewed, updated, and suggested. Keep the report brief (3-5 bullet points).

## Daily Memory Log Format

When writing daily logs to `memory/YYYY-MM-DD.md`:

```markdown
# YYYY-MM-DD

## Key Interactions
- [summary of important conversations]

## Learnings
- [new insight or pattern]

## Action Items
- [things to follow up on]
```

## HEARTBEAT Integration

Add these lines to `HEARTBEAT.md` to enable periodic self-improvement:

```markdown
- Review recent memory/YYYY-MM-DD.md and update MEMORY.md with distilled learnings
- Remove outdated info from MEMORY.md
- If clawhub available: search for useful skills, suggest to user (do NOT auto-install)
```
