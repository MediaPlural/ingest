// tests/embed-parse.test.js — the widget's pure functions (no DOM).
const { test } = require("node:test");
const assert = require("node:assert");
const { parseManifest, esc, OS_LINES } = require("../host/embed.js");

const MANIFEST = `# INGEST.md — machine manifest for \`agentic-testing\`

> Convention: MediaPlural/ingest — INGEST.md (canonical) / AGENT-INGEST.md (alias), one schema.
> **Package fingerprint (sha256):** \`42b5d7f1a7501cf3\` — verify after transfer; if it differs, the tree changed.

**Visibility:** unlisted — ingestion is open to anyone holding the reference (not listed/indexed).

## Load order (the one required section)

1. BLUF (below) — the one-paragraph bottom line.
2. The files in the file map, in listed order.

## BLUF

The answer as a working harness: 6-tier CI ladder, personas, attack fixtures, panels.

## Quip

> the build gate stays red until every attack is caught — that's the whole personality

## File map

- \`docs/README.md\` — 2,132 bytes
- \`docs/ops/agentic-testing.md\` — 19,605 bytes

## The one-liner

**Prompt form:** Read \`INGEST.md\` at the artifact root and execute its load order; it routes everything else.
`;

test("parseManifest extracts fingerprint, title, bluf, quip, files, visibility", () => {
  const m = parseManifest(MANIFEST);
  assert.equal(m.fp, "42b5d7f1a7501cf3");
  assert.equal(m.title, "agentic-testing");
  assert.match(m.bluf, /working harness/);
  assert.match(m.quip, /the build gate stays red/);
  assert.equal(m.files.length, 2);
  assert.equal(m.files[0].path, "docs/README.md");
  assert.equal(m.vis, "unlisted");
});

test("esc() neutralizes the XSS vectors (the widget's security law)", () => {
  const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const safe = esc(evil);
  assert.ok(!safe.includes("<img"));
  assert.ok(!safe.includes("<script"));
  assert.ok(safe.includes("&lt;img"));
});

test("OS_LINES covers every detectOS outcome", () => {
  for (const os of ["windows", "mac", "linux", "mobile", "unknown"]) {
    assert.ok(typeof OS_LINES[os] === "string" && OS_LINES[os].length > 0, os);
  }
});