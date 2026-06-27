# Code Review Prompt
# Use this when you want Claude Code to audit the project.
# Run: paste this into Claude Code after it has read the project files.

---

You are a senior software architect reviewing a WhatsApp group broadcasting application.
Stack: Node.js + Express + whatsapp-web.js + React. Hosted on Railway.

## Step 1 — Architecture Scan
Read all files. Map:
- Entry points
- Core modules vs. plugin features
- External integrations (WhatsApp, email, etc.)
- Folder structure vs. expected structure in CLAUDE.md

## Step 2 — Code Review
For each module assess:
1. Single Responsibility — does each file/function do ONE thing?
2. Coupling — does any plugin import from another plugin? Does core import plugins?
3. Error handling — are plugin errors caught so they don't crash the app?
4. Secrets — any hardcoded credentials, URLs, phone numbers, or emails?
5. EventBus usage — does core emit events correctly? Do plugins only listen, never emit to core?
6. Railway compatibility — anything that won't survive a container restart? (file paths, session storage)

## Step 3 — Skill Recommendations
Based on what you found, recommend which skills to use next:
- `modular-feature-dev` — if new features need to be added
- `whatsapp-session-resilience` — if session drops are not handled
- `railway-deployment` — if deployment config is missing or incorrect
- `media-upload-handler` — if file/audio/video upload logic is messy
- `frontend-state-management` — if React state is getting complex

## Step 4 — Modularity Gap Report
Simulate: "Add Telegram support as a second messaging channel."
What would need to change? How many files? Is the core too WhatsApp-specific?

## Output Format

### Architecture Summary
[2-3 sentences]

### Critical Issues (must fix before next feature)
[Numbered list]

### Modularity Score: X/10
[Explanation]

### Recommended Next Skills
[List]

### Quick Wins (< 30 min each)
[List]
