#!/usr/bin/env python3
"""card.py — the dual-surface share card (v1.1 of the convention).

  ingest card <dir>            terminal card + one-liner (as shipped)
  ingest card <dir> --embed    ALSO writes share-card.html with the full
                               OpenGraph/Twitter embed contract (v1.1)

The embed contract (from EMBED-CAPABILITY-MODEL): og:title/description/image/url
+ declared dimensions + literal og:image:alt + og:site_name + exactly ONE
Twitter-specific line (twitter:card=summary_large_image — no OG equivalent,
and both X and Discord key off it). The card image is referenced, not
required; generate it with examples/make-card.py.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys

CANONICAL = "INGEST.md"
ALIAS = "AGENT-INGEST.md"

EMBED_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{pkg} — INGEST.md package</title>
<meta property="og:title" content="{pkg}">
<meta property="og:description" content="{bluf1}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Share card: package name, one-paragraph summary, and sha256 fingerprint on a dark background.">
<meta property="og:site_name" content="INGEST.md — the shareable-artifact manifest convention">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<meta http-equiv="refresh" content="0; url=./{canonical}">
<p>Redirecting to the manifest… If your agent sent you here: <b>Read {canonical} and execute its load order.</b></p>
</body>
</html>"""


def find_manifest(root: pathlib.Path):
    for name in (CANONICAL, ALIAS):
        p = root / name
        if p.exists():
            return p
    return None


def fingerprint_files(root: pathlib.Path):
    h = hashlib.sha256()
    for f in sorted(p for p in root.rglob("*")
                    if p.is_file() and p.name not in (CANONICAL, ALIAS)):
        h.update(f.read_bytes())
    return h.hexdigest()[:16]


def read_bluf(root):
    md = find_manifest(root)
    if not md:
        return ""
    t = md.read_text(encoding="utf-8")
    m = re.search(r"## BLUF\s*\n\n(.+?)(?:\n\n|\Z)", t, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def cmd_card(args):
    root = pathlib.Path(args.dir).resolve()
    md = find_manifest(root)
    if not md:
        print(f"no {CANONICAL}/{ALIAS} in {root} — run `ingest init` first", file=sys.stderr)
        return 2
    text = md.read_text(encoding="utf-8")
    fp = (re.search(r"`([0-9a-f]{16})`", text) or [None, "—"])[1]
    bluf = read_bluf(root)
    name = root.name
    bar = "─" * 60
    print("┌" + bar + "┐")
    print(f"│ {name[:56]:<56} │")
    print("├" + bar + "┤")
    for line in (bluf[:56],):
        print(f"│ {line:<56} │")
    print("└" + bar + "┘")
    print()
    print("THE ONE-LINER:")
    print(f"  Read {md.name} at the artifact root and execute its load order; it routes everything else.")
    if args.embed:
        bluf1 = (bluf.split(". ")[0] + ".") if bluf else "A shareable-artifact package."
        html = EMBED_TEMPLATE.format(
            pkg=name, bluf1=bluf1[:180], url=args.url or "", img=args.image or "",
            canonical=md.name,
        )
        out = root / "share-card.html"
        out.write_text(html, encoding="utf-8")
        print(f"\nembed surface written: {out}")
        print("  og:title/og:description/og:image + twitter:card=summary_large_image")
        print("  next: generate the image (examples/make-card.py) and pass --image/--url")
    return 0


def main():
    ap = argparse.ArgumentParser(prog="ingest")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("card", help="emit the share card + one-liner; --embed adds the HTML surface")
    c.add_argument("dir")
    c.add_argument("--embed", action="store_true", help="also write share-card.html (the OG/Twitter embed)")
    c.add_argument("--url", default="", help="the package's public URL (og:url)")
    c.add_argument("--image", default="", help="the card image URL (og:image)")
    c.set_defaults(fn=cmd_card)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())