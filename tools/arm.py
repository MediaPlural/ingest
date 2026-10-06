#!/usr/bin/env python3
"""arm.py — arm a package for the ingest.fm/viiy.to host.

  python3 tools/arm.py <artifact-dir> [--slug name] [--out host-packages-dir]
                       [--url https://viiy.to/<slug>] [--bluf-file path]

Reads INGEST.md/AGENT-INGEST.md from the artifact dir (per the discovery
order), copies the artifact set into the host's packages/<slug>/ dir, and
stamps the share URL. The host's resolver serves the three surfaces from
that dir. The manifest is the single source of truth; the card renders
FROM it, never beside it.

Exit: 0 armed; 1 no manifest; 2 copy failure.
"""
import argparse
import hashlib
import pathlib
import shutil
import sys

CANONICAL = "INGEST.md"
ALIAS = "AGENT-INGEST.md"


def find_manifest(root: pathlib.Path):
    for name in (CANONICAL, ALIAS):
        p = root / name
        if p.exists():
            return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--slug")
    ap.add_argument("--out", default="packages")
    ap.add_argument("--url")
    ap.add_argument("--bluf-file")
    args = ap.parse_args()

    root = pathlib.Path(args.dir).resolve()
    md = find_manifest(root)
    if md is None:
        print(f"no {CANONICAL}/{ALIAS} in {root} — run `ingest init` first", file=sys.stderr)
        return 1

    slug = args.slug or root.name
    out = pathlib.Path(args.out) / slug
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    # copy the artifact set (manifests included — the host serves them)
    for f in sorted(root.rglob("*")):
        if f.is_file():
            dst = out / f.relative_to(root)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)

    # stamp the share URL onto a copy of the manifest (not the original)
    manifest_dst = out / (CANONICAL if (out / CANONICAL).exists() else ALIAS)
    text = manifest_dst.read_text(encoding="utf-8")
    if args.url:
        text = text.replace("## Visibility", f"## Share URL\n\n`{args.url}`\n\n## Visibility", 1) \
            if "## Visibility" in text else text + f"\n\n## Share URL\n\n`{args.url}`\n"
        manifest_dst.write_text(text, encoding="utf-8")

    print(f"armed: {slug} → {out} ({sum(1 for _ in out.rglob('*') if _.is_file())} files)")
    if args.url:
        print(f"share URL: {args.url}")
        print(f"one-liner: Read {args.url}/INGEST.md and execute its load order; it routes everything else.")
    return 0


if __name__ == "__main__":
    sys.exit(main())