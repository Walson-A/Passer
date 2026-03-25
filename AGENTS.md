# Passer Agent Rules (Superpowers)

This document defines the behavior and standards for AI agents working on the Passer project.

## 🚀 Core Principles

1. **Documentation is Mandatory**: Never implement a feature without updating `docs/` or technical documentation.
2. **Architecture First**: Strictly follow `docs/architecture.md`. No ad-hoc structural changes.
3. **Implicit Verification**: Always run builds/tests and provide evidence in `walkthrough.md` before claiming a task is done.
4. **Single-Flow Mastery**: Antigravity agents must use `task_boundary` and `implementation_plan.md` for any non-trivial work.

## 🔧 Antigravity Tool Translation

When using skills that reference legacy tools, use these Antigravity equivalents:

- `Task` tool → `browser_subagent` for browser tasks, otherwise sequential `task_boundary`.
- `Skill` tool → `view_file .agent/skills/<skill-name>/SKILL.md`.
- `TodoWrite` → Update the native Antigravity `task.md` artifact.
- `PlanWrite` → Create/update the native Antigravity `implementation_plan.md` artifact.
- `WalkthroughWrite` → Create/update the native Antigravity `walkthrough.md` artifact.
- `User Communication` → Only via `notify_user` during an active task.

## 🏗️ Technical Stack Constraints

- **App**: Tauri v2 (Rust) + React.
- **Website**: Vite + React + TailwindCSS 4.
- **Style**: Vanilla CSS or TailwindCSS with premium glassmorphism tokens.
- **Integration**: iOS Shortcuts REST API.

---

*Keep this project lean, fast, and remarkably polished.*
