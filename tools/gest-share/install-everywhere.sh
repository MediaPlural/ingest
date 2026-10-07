#!/usr/bin/env bash
# gest-share install-everywhere — install/refresh the gest-share skill in every
# detected runtime (Hermes, .viiy, Claude Code, OpenClaw, Cursor, VS Code/Copilot).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL_SRC="$HERE/../../skills/gest-share"

say() { printf '[gest-share install-everywhere] %s\n' "$*"; }
pin() { printf '\n<!-- resolved repo path: %s -->\n' "$HERE" >> "$1/SKILL.md"; }

say "engine: $HERE"

# --- 1. Hermes (always) ---
mkdir -p "$HOME/.hermes/skills"
rm -rf "$HOME/.hermes/skills/gest-share"
cp -R "$SKILL_SRC" "$HOME/.hermes/skills/gest-share"
pin "$HOME/.hermes/skills/gest-share"
say "Hermes: installed -> ~/.hermes/skills/gest-share"

# --- 2. .viiy (the personal runtime state — adapter manifest) ---
if [ -d "$HOME/.viiy" ]; then
  mkdir -p "$HOME/.viiy/adapters"
  rm -rf "$HOME/.viiy/adapters/gest-share"
  mkdir -p "$HOME/.viiy/adapters/gest-share"
  cp "$SKILL_SRC/SKILL.md" "$HOME/.viiy/adapters/gest-share/SKILL.md"
  pin "$HOME/.viiy/adapters/gest-share"
  say ".viiy: installed -> ~/.viiy/adapters/gest-share"
else
  say ".viiy: not detected, skipped"
fi

# --- 3. Claude Code (if dir present) ---
if [ -d "$HOME/.claude" ]; then
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$HOME/.claude/skills/gest-share"
  cp -R "$SKILL_SRC" "$HOME/.claude/skills/gest-share"
  pin "$HOME/.claude/skills/gest-share"
  say "Claude Code: installed -> ~/.claude/skills/gest-share"
else
  say "Claude Code: not detected, skipped"
fi

# --- 4. OpenClaw (if present) ---
if [ -d "$HOME/.openclaw" ]; then
  mkdir -p "$HOME/.openclaw/skills"
  rm -rf "$HOME/.openclaw/skills/gest-share"
  cp -R "$SKILL_SRC" "$HOME/.openclaw/skills/gest-share"
  pin "$HOME/.openclaw/skills/gest-share"
  say "OpenClaw: installed -> ~/.openclaw/skills/gest-share"
else
  say "OpenClaw: not detected, skipped (install OpenClaw, then re-run)"
fi

# --- 5. Cursor (user skills dir present) ---
if [ -d "$HOME/.cursor" ]; then
  mkdir -p "$HOME/.cursor/skills"
  rm -rf "$HOME/.cursor/skills/gest-share"
  cp -R "$SKILL_SRC" "$HOME/.cursor/skills/gest-share"
  pin "$HOME/.cursor/skills/gest-share"
  say "Cursor: installed -> ~/.cursor/skills/gest-share"
else
  say "Cursor: not detected, skipped"
fi

say "done — every detected runtime now speaks gest"