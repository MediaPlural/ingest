# INGEST.md SPEC — v1.0 (2026-10-05)

**Canonical filename:** `INGEST.md` · **Registered alias:** `AGENT-INGEST.md` · **One schema, one discovery order.**

## 1. Purpose

A machine-readable manifest at the root of a shareable artifact: the receiving agent reads one file and knows what it holds, in what order to consume it, and whether the bytes are intact.

## 2. Discovery order (normative)

A consuming tool looks for, in order:

1. `INGEST.md` (canonical)
2. `AGENT-INGEST.md` (alias)

Both validate identically against the same schema (§5). A package may ship either or both; content must be identical if both are present. **The discovery order is part of this spec** — implementing it is required for a conforming reader.

## 3. Required vs optional (the composable-minimal rule)

- **REQUIRED section:** `## Load order` — the single entry-point contract. A conforming reader must be able to consume the package by parsing the load order alone.
- **REQUIRED fields:** the package **fingerprint** (sha256 over the artifact set, the manifest files themselves excluded) and the **file map** (paths + sizes).
- **OPTIONAL sections** (must degrade gracefully when absent): `## BLUF`, visibility (`unlisted` | `public` | `private`), provenance, grants, video reference, laws/notes.

A reader that cannot parse an optional section MUST ignore it, never fail.

## 4. The fingerprint (normative)

`sha256` over every file in the artifact set — sorted by path, byte-concatenated, **manifest files (both names) excluded** — hex-truncated to 16 characters. Recompute after transfer; a mismatch means the tree changed. The reference CLI's `verify` exits 0 on match, 2 on mismatch.

## 5. Manifest schema

See `schema/ingest-manifest.schema.json` (JSON Schema draft-07). The generated markdown manifest is the human-readable projection of that object; the schema is the machine contract.

## 6. The two-name rule (normative)

`INGEST.md` is canonical (the generic, adoption-maximalist filename — the `llms.txt` family). `AGENT-INGEST.md` is the registered alias (the `AGENTS.md`-kin descriptive form). One spec, one schema, both names claimed — so no rival spec can fork the convention. The manifest itself carries a `canonical_name` + `alias` note.

## 7. The event vocabulary (named, not prescribed)

Three events are defined **semantically** so the vocabulary spreads with the format:

- **`share_sent`** — the artifact was sent by its sharer (carries artifact id, fingerprint, channel).
- **`share_opened`** — the share surface was opened by a human recipient.
- **`agent_ingested`** — the receiving *agent* fetched the manifest and executed the load order (the machine analog of "received and read").

How you detect and record these events is your implementation. This spec defines the manifest, not the analytics; it prescribes no measurement mechanism.

## 8. Conformance

A **conforming writer** emits manifests that validate against §5 and carry §3's required section and fields. A **conforming reader** implements the §2 discovery order and can consume via the load order alone. The reference CLI (`ingest.py`) is both.

## 9. License

- This SPEC and the format: **CC-BY 4.0** (see `LICENSE-SPEC`)
- Reference code: **Apache 2.0** (see `LICENSE`)

## Changelog

- **v1.0 (2026-10-05)** — initial public spec: two-name rule, discovery order, required-sections rule, fingerprint normative definition, schema, event vocabulary.