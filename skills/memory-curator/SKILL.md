---
name: memory-curator
description: Maintain, organize, and optimize the agent memory files (MEMORY.md and daily logs). Use when memory needs cleanup, when context is getting stale, or when user says "clean up memory" or "organize what you know". Only touches workspace memory files.
metadata: { "openclaw": { "emoji": "🗂️" } }
---

# Memory Curator

Systematically maintain the agent's memory files to keep knowledge fresh, organized, and useful.

## When to Trigger

- User asks to "clean up memory", "organize notes", "what do you remember"
- During heartbeat when MEMORY.md exceeds 150 lines
- After a major project milestone or context switch

## Safety Boundaries

**Scope:** Only reads/writes files in the workspace `memory/` directory and `MEMORY.md`.  
**Never:** deletes session logs, modifies config, or touches files outside the workspace.

## Memory File Structure

```
workspace/
  MEMORY.md           # Distilled long-term knowledge (keep under 200 lines)
  memory/
    YYYY-MM-DD.md     # Daily interaction logs
```

## Curation Tasks

### 1. Audit MEMORY.md

Check for:
- **Staleness**: entries older than 30 days that haven't been referenced
- **Redundancy**: duplicate or near-duplicate entries
- **Accuracy**: information contradicted by recent interactions
- **Organization**: proper section headers and logical grouping

### 2. Organize by Category

Recommended MEMORY.md structure:

```markdown
# Agent Memory

## User Profile
- Name, preferences, communication style
- Timezone, language preferences

## Project Context
- Active projects and their status
- Key technical decisions made

## Effective Patterns
- Approaches that work well for this user
- Preferred tools and workflows

## Known Constraints
- Things to avoid
- System limitations discovered

## Recent Learnings
- Insights from the last 7 days
- Updated: YYYY-MM-DD
```

### 3. Compress Daily Logs

For daily logs older than 14 days:
- Extract key learnings into MEMORY.md
- Keep the daily log file but mark it as "archived" (add `<!-- archived -->` at top)
- Do NOT delete daily logs

### 4. Cross-Reference Check

Verify that MEMORY.md entries align with recent daily logs:
- If a preference changed, update MEMORY.md
- If a project completed, move it to a "Completed" section or remove it
- If a tool is no longer used, note the change

## Output

After curation, report:
- Lines before/after in MEMORY.md
- Number of entries added/removed/updated
- Any stale items flagged for user review
