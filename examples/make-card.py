#!/usr/bin/env python3
"""make-card.py — generate the 1200x630 share-card PNG from a package's INGEST.md.

The card IS the manifest, rendered: title from the manifest, BLUF from the manifest,
fingerprint from the manifest — the two surfaces cannot disagree.

Optional companion to the stdlib-only ingest CLI (this uses matplotlib, which is
not part of the core convention; the image is referenced by --image, not required).
Usage: python3 make-card.py <artifact-dir> [--out share-card.png]
"""
import argparse
import pathlib
import re
import sys

WIDTH, HEIGHT = 1200, 630


def parse_manifest(root: pathlib.Path):
    md = None
    for name in ("INGEST.md", "AGENT-INGEST.md"):
        p = root / name
        if p.exists():
            md = p.read_text(encoding="utf-8")
            break
    if md is None:
        raise SystemExit("no INGEST.md / AGENT-INGEST.md in " + str(root))
    title = (re.search(r"^# .*?machine manifest for `?([^`\n]+)`?", md, re.M) or [None, root.name])[1].strip()
    fp = (re.search(r"fingerprint \(sha256\)\*\*: `([0-9a-f]+)`", md) or re.search(r"\*\*Package fingerprint.*?:\*\* `([0-9a-f]+)`", md) or [None, "—"])[1]
    bluf = ""
    m = re.search(r"## BLUF\s*\n\n(.+?)(?:\n\n|\Z)", md, re.S)
    if m:
        bluf = re.sub(r"\s+", " ", m.group(1)).strip()
    return title, fp, bluf[:180]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", type=pathlib.Path)
    ap.add_argument("--out", default="share-card.png")
    args = ap.parse_args()

    title, fp, bluf = parse_manifest(args.dir)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig = plt.figure(figsize=(12, 6.3), dpi=100)
    fig.patch.set_facecolor("#0d1117")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")

    ax.text(0.06, 0.82, title, fontsize=34, fontweight="bold", color="#e6edf3",
            va="center", family="DejaVu Sans")
    ax.text(0.06, 0.70, "A shareable-artifact package · INGEST.md convention", fontsize=15,
            color="#8b949e", va="center")
    # the BLUF, wrapped
    import textwrap
    wrapped = "\n".join(textwrap.wrap(bluf or "(no BLUF set)", 68))[:390]
    ax.text(0.06, 0.48, wrapped, fontsize=16, color="#c9d1d9", va="center", linespacing=1.5)
    # fingerprint band
    ax.text(0.06, 0.12, f"sha256 fingerprint: {fp}", fontsize=13, color="#58a6ff",
            family="DejaVu Sans Mono", va="center")
    ax.text(0.06, 0.05, "verify after transfer · if it differs, the tree changed", fontsize=11,
            color="#8b949e", va="center", style="italic")

    fig.savefig(args.out, facecolor="#0d1117")
    print("card written:", args.out)
    print("size check: 1200x630, keep under 1MB for GitHub/X compatibility")


if __name__ == "__main__":
    main()