# INGEST.md — machine manifest for `agentic-testing`

> Convention: MediaPlural/ingest — INGEST.md (canonical) / AGENT-INGEST.md (alias), one schema.
> **Package fingerprint (sha256):** `42b5d7f1a7501cf3` — verify after transfer; if it differs, the tree changed.

**Visibility:** unlisted — ingestion is open to anyone holding the reference (not listed/indexed).

## Load order (the one required section)

1. BLUF (below) — the one-paragraph bottom line.
2. The files in the file map, in listed order.


## BLUF

The answer to "how do we do agentic testing of the sales engine" as a working harness: 6-tier CI ladder (unit → PG-IT → keyless eval → keyed eval with pass^k → replay/shadow → live test), 10 adversarial + 4 dimensional personas, 11 attack fixtures all caught by named checks, 8 new deterministic rubric checks, experience + corpus-health panels, and the ops runbook + lifecycle maps. Ships as refurbapp PR #1162 (45 files, all gates green: 133/133 tests, typecheck clean, attack mode 11/11 caught). Read in order: the runbook first, then the lifecycle maps, then the README.

## Tagline

> the build gate stays red until every attack is caught

## File map

- `docs/README.md` — 2,132 bytes
- `docs/ops/agentic-testing.md` — 19,605 bytes
- `docs/ops/lifecycle-map.md` — 13,946 bytes

## The one-liner

**Prompt form:** Read `INGEST.md` at the artifact root and execute its load order; it routes everything else.
**CLI form:** `ingest <dir>` — this reference tool reads the manifest.
