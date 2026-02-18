# AGENTS.md

This file provides lightweight, repo-specific guidance for AI agents or
automation working in this codebase. The goal is to help, not slow down,
development. Keep it short and adjust as the project evolves.

## Core principles
- Prefer small, focused changes that are easy to review and revert.
- Avoid destructive commands unless explicitly requested.
- Keep ASCII text unless a file already uses Unicode.
- If unsure about intent, ask a targeted question rather than guessing.

## Workflow
- Check for existing conventions in nearby files before introducing new patterns.
- When changing behavior, note risks and suggest tests (do not run unless asked).
- Do not reformat unrelated code.

## Files and paths
- Respect existing folder structure; place new files in the most relevant area.
- When referencing files, include a standalone path (no ranges).

## Communication
- Summarize what changed and why.
- Call out any open questions or assumptions.
