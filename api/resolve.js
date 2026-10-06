// api/resolve.js — the UA-aware resolver (Vercel serverless function).
// One URL, three readers: crawlers get OG, agents get the manifest, humans get the card.
// Deployed identically at ingest.fm (public reference host) and viiy.to (personal host).

const { classify } = require("./lib/classify.js");

// In production, slugs map to package dirs under /packages. Locally and in the
// playground these are the same shape — the resolver never needs to know.
const PACKAGES_ROOT = process.env.PACKAGES_ROOT || "packages";

const SITE = {
  name: "ingest.fm",
  tagline: "INGEST.md — the shareable-artifact manifest convention",
  repo: "https://github.com/MediaPlural/ingest",
};

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const { view, slug, file } = classify(url.pathname, req.headers);
  const host = ((req.headers.host || req.headers.Host || "") || "").toLowerCase();
  const siteName = host.endsWith("viiy.to")
    ? "viiy.to"
    : host.endsWith("ingest.fm")
      ? "ingest.fm"
      : process.env.SITE_NAME || SITE.name;

  // share_opened fires on every resolution (implementation-side; the spec
  // only names the events — how we record them is ours).
  try {
    res.setHeader("X-Ingest-Fm", `view=${view} slug=${slug || "-"}`);
  } catch {}

  const html = (body, status = 200) => {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  };

  // ── package routes ─────────────────────────────────────────────
  if (view === "manifest") {
    const manifest = await readPackageFile(slug, file || "INGEST.md");
    if (!manifest) return notFound(res, slug);
    res.writeHead(200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Access-Control-Allow-Origin": "*",
    });
    return res.end(manifest.text);
  }

  if (view === "og" || view === "card") {
    const manifest = await readPackageFile(slug, "INGEST.md");
    if (!manifest) return notFound(res, slug);
    const cardPage = cardHTML(manifest, { ogOnly: view === "og", siteName });
    return html(cardPage);
  }

  if (view === "file") {
    const data = await readPackageFile(slug, file);
    if (!data) return notFound(res, slug, file);
    const types = {
      ".md": "text/markdown", ".txt": "text/plain", ".json": "application/json",
      ".jsonl": "text/plain", ".png": "image/png", ".jpg": "image/jpeg",
      ".mp4": "video/mp4", ".html": "text/html", ".csv": "text/csv",
      ".zip": "application/zip", ".py": "text/plain", ".js": "text/javascript",
    };
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    const blob = await readPackageFile(slug, file);
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    return res.end(blob.text);
  }

  // ── index ──────────────────────────────────────────────────────
  const slugs = await listSlugs();
  return html(indexHTML(slugs, siteName));
};

// ── helpers ──────────────────────────────────────────────────────
async function readPackageFile(slug, file) {
  if (!slug) return null;
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, "");
  const safeFile = (file || "").replace(/[^a-zA-Z0-9._\/-]/g, "").replace(/\.+/g, ".").replace(/\/{2,}/g, "/");
  if (!safeSlug || !safeFile || safeFile.includes("..")) return null;
  try {
    const fs = require("fs/promises");
    const p = `${PACKAGES_ROOT}/${safeSlug}/${safeFile}`;
    const text = await fs.readFile(p, "utf8");
    return { text };
  } catch {
    return null;
  }
}

async function listSlugs() {
  try {
    const fs = require("fs/promises");
    const entries = await fs.readdir(PACKAGES_ROOT);
    return entries.filter((d) => !d.startsWith("."));
  } catch {
    return [];
  }
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function notFound(res, slug, file) {
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>not found — ingest.fm</title></head>
<body style="font-family:ui-monospace,monospace;background:#0d1117;color:#e6edf3;padding:8vh 24px">
<h2>404</h2><p>No package <code>${esc(slug || "")}</code>${file ? ` / <code>${esc(file)}</code>` : ""} here.</p>
<p><a style="color:#58a6ff" href="/">← ingest.fm</a></p></body></html>`;
  res.writeHead(404, { "Content-Type": "" + "text/html; charset=utf-8" });
  res.end(body);
}

function manifestFields(text) {
  const fp = (text.match(/`([0-9a-f]{16})`/) || [])[1] || "";
  const bluf = (text.match(/## BLUF\s*\n\n([\s\S]+?)(?:\n\n|\Z)/) || [])[1] || "";
  const bluf1 = bluf.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] || bluf.slice(0, 160);
  const files = [...text.matchAll(/^- `([^`]+)` — ([\d,]+) bytes/gm)].map((m) => ({ path: m[1], size: m[2] }));
  const title = (text.match(/^# INGEST\.md — machine manifest for `([^`]+)`/) || [])[1] || "package";
  return { fp, bluf: bluf.replace(/\s+/g, " ").trim(), bluf1, files, title };
}

function cardHTML(m, { ogOnly = false, siteName } = {}) {
  const f = manifestFields(m.text);
  const canonical = m.text.includes("AGENT-INGEST.md") ? "INGEST.md" : "INGEST.md";
  const ogBlock = `
<meta property="og:title" content="${esc(f.title)}">
<meta property="og:description" content="${esc(f.bluf1)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(m.url || "")}">
<meta property="og:image" content="${esc(m.image || "")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Share card: ${esc(f.title)}, one-paragraph summary, and sha256 fingerprint on a dark background.">
<meta property="og:site_name" content="${esc(siteName)}">
<meta name="twitter:card" content="summary_large_image">`;
  const style = `<style>
  body { margin:0; font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif; background:#0d1117; color:#e6edf3; }
  .card { max-width:640px; margin:8vh auto; padding:0 24px 48px; }
  h1 { font-size:34px; margin:0 0 8px; } .sub { color:#8b949e; font-size:15px; margin-bottom:28px; }
  .bluf { font-size:17px; line-height:1.6; color:#c9d1d9; margin-bottom:28px; }
  .fp { font-family:ui-monospace,Menlo,Consolas,monospace; color:#58a6ff; font-size:14px; }
  .fphint { color:#8b949e; font-size:12px; font-style:italic; margin:4px 0 32px; }
  .oneliner { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:14px 16px;
              font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; color:#e6edf3; }
  .oneliner b { color:#58a6ff; }
  .files { margin:32px 0 0; font-size:13px; color:#8b949e; font-family:ui-monospace,monospace; line-height:1.8; }
  a { color:#58a6ff; text-decoration:none; }
</style>`;
  const body = `
<div class="card">
  <h1>${esc(f.title)}</h1>
  <div class="sub">A shareable-artifact package · INGEST.md convention · ${esc(siteName)}</div>
  <div class="bluf">${esc(f.bluf)}</div>
  <div class="fp">sha256 fingerprint: ${esc(f.fp)}</div>
  <div class="fphint">verify after transfer — if it differs, the tree changed</div>
  <div class="oneliner">For your agent: <b>Read ${canonical} at the artifact root and execute its load order; it routes everything else.</b></div>
  <div class="files">${f.files.map((x) => `${esc(x.path)} — ${x.size} bytes`).join("<br>")}</div>
  <p><a href="./INGEST.md">INGEST.md manifest →</a> · <a href="/">← host home</a></p>
</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(f.title)} — ${esc(siteName)}</title>${ogBlock}${style}
</head><body>${body}</body></html>`;
}

function indexHTML(slugs, siteName) {
  const list = slugs.length
    ? slugs.map((s) => `<li><a href="/${esc(s)}">${esc(s)}</a></li>`).join("")
    : `<li><em>no packages armed yet</em></li>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(siteName)} — INGEST.md live host</title>
<meta property="og:title" content="${esc(siteName)} — INGEST.md live host">
<meta property="og:description" content="The live reference host for the INGEST.md shareable-artifact manifest convention. One URL, three readers: crawlers get the card unfurl, humans get the card page, agents get the manifest.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<style>body{margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;background:#0d1117;color:#e6edf3;padding:8vh 6vw}
a{color:#58a6ff;text-decoration:none} h1{font-size:28px} li{margin:8px 0}</style>
</head><body>
<h1>${esc(siteName)}</h1>
<p>The live reference host for the <a href="${SITE.repo}">INGEST.md convention</a>.</p>
<p>One URL, three readers: <b>crawlers</b> get the unfurl, <b>humans</b> get the card, <b>agents</b> get the manifest.</p>
<ul>${list}</ul>
<p><a href="/try">try the playground →</a></p>
</body></html>`;
}