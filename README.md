# INGEST.md — the shareable-artifact manifest convention

**An artifact that travels with its own machine digest.**

When you share a package — a report, a code deliverable, a research corpus, a video + docs bundle — the human gets a link. But their *agent* gets nothing: no summary it can trust, no file order it can follow, no way to know the tree it fetched is the tree you sent.

**INGEST.md is the missing convention: a machine-readable manifest at the artifact root** — one file that carries the bottom line (BLUF), the load order, the file map, and a sha256 fingerprint of the whole set. The receiving agent reads one file and knows exactly what it holds, in what order to consume it, and whether the bytes are intact.

```text
┌──────────────────────────┐        ┌──────────────────────────┐
│  HUMAN SURFACE           │        │  MACHINE SURFACE         │
│  share card: title+BLUF  │  ───►  │  INGEST.md manifest:     │
│  + link                  │        │  load order · file map   │
│                          │        │  sha256 fingerprint      │
└──────────────────────────┘        └──────────────────────────┘
```

## The one-liner (for the receiving agent)

```text
Read INGEST.md at the artifact root and execute its load order; it routes everything else.
```

## Why adopt instead of rebuild

- **The file is the SDK.** `ingest init` generates the manifest from any directory; `ingest verify` recomputes the fingerprint; `ingest card` emits the share card + one-liner. Stdlib-only Python — zero dependencies, no account, no service.
- **Composable-minimal spec.** One required section (the **load order**), a small required field set (fingerprint, file map). Everything else — BLUF, visibility, provenance — degrades gracefully.
- **Capabilities are toggles.** The manifest law is the only invariant; every capability beyond the core (boards/feeds, visibility tiers, grants, commerce delivery, cost-sharing) is a deployment switch — on or off for your use case. The reference hosts are just different configs of the same modular stack.
- **Two names, one format.** `INGEST.md` is canonical; `AGENT-INGEST.md` is a registered alias validating against the same schema. Discovery order: `INGEST.md` first, `AGENT-INGEST.md` second. (Namespace defense — see SPEC.md.)
- **Schemas travel with the format.** The manifest schema ships in this repo; the event vocabulary (`share_sent` / `share_opened` / `agent_ingested`) is defined semantically in SPEC.md so the concepts spread with the format.

## Quick start

```bash
git clone https://github.com/MediaPlural/ingest
cd ingest

# arm any artifact directory for sharing
python3 ingest.py init ./my-package --bluf bluf.txt

# verify after transfer (exit 0 = intact, exit 2 = tampered/changed)
python3 ingest.py verify ./my-package

# emit the share card + one-liner
python3 ingest.py card ./my-package
```

See `examples/simple-package/` for a generated manifest.

## Bringing content in (the source lane)

`ingest.py` presumes you already have the artifact set. Most adopters don't — the content lives in a CMS, an API, or a feed. `tools/ingest-source.py` materializes it, then hands off to the core:

```bash
# fetch any of: dir | file | json (content API) | rss (RSS 2.0 or Atom)
python3 tools/ingest-source.py fetch --source rss --from https://example.com/feed --out ./pkg

# then arm it exactly as always — the source lane writes no manifest of its own
python3 ingest.py init ./pkg --bluf bluf.txt --visibility public
python3 ingest.py verify ./pkg
```

- **It is a sibling tool, not a verb in `ingest.py`.** The format core stays the invariant; sources are a deployment capability. Nothing about the manifest changes because of where the bytes came from.
- **Provenance at the door.** Every item lands as Markdown (front-matter carries title / source_url / published / fetched_at) and `SOURCES.json` records origin + sha256 + bytes per item, so the tree you armed can be traced back to where it came from.
- **Field names are matched loosely** across the common vendor shapes (`title|name|headline`, `url|link|permalink`, `text|content|body|summary|…`), so no per-vendor adapter is ever needed.
- **Deterministic.** `--now <ISO>` pins the clock: the same source yields byte-identical content, into any directory. Only the receipt's own log fields (`out`, `fetched_at`) vary.
- **Refusal is an outcome, not a crash.** A missing locator, a malformed payload, an empty result, or XML carrying a DTD/entity declaration exits `2`, prints the reason, and writes nothing. Payloads are size-capped and DTD-bearing XML is refused outright, so the stdlib parser is safe here without a dependency.
- **Zero dependencies, still.** Python 3.9 through 3.13 — the annotations are lazy.

## The event vocabulary (named, not prescribed)

SPEC.md defines three events *semantically* — `share_sent`, `share_opened`, `agent_ingested` — so measurement vocabulary spreads with the convention. How you detect and record them is your implementation; this convention defines the manifest, not the analytics.

## License

- **SPEC.md + the format itself:** CC-BY 4.0 (`LICENSE-SPEC`)
- **Reference code (`ingest.py`, `tools/`):** Apache 2.0 (`LICENSE`)

## Prior art & kin (honest)

`AGENTS.md` owns repo-instruction conventions; `llms.txt` and Jina Reader (`r.jina.ai`) own hosted-URL → LLM-readable conversion; A2A owns the Agent Card. INGEST.md claims the unclaimed lane: **the shareable-ingest manifest** — what an agent reads when an artifact *arrives*, not when it's hosted.