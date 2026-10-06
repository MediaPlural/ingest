// api/resolve.js — the UA-aware resolver (Vercel serverless function).
// One URL, three readers: crawlers get OG, agents get the manifest, humans get the card.
// Public crown: agnt.in ("agent ingest" — the AGENT-INGEST.md alias as a domain).
// ingest.my + ingest.fm alias the crown; viiy.to is the personal host.

const { classify, TRY } = require("./lib/classify.js");
const PACKAGES = require("./lib/packages.generated.js");

// In production, slugs map to package dirs under /packages at build time —
// tools/embed-packages.js bakes them into api/lib/packages.generated.js, so
// the resolver never touches the filesystem at runtime (cwd is / on Vercel).

const SITE = {
  name: "agnt.in",
  tagline: "INGEST.md — the shareable-artifact manifest convention",
  repo: "https://github.com/MediaPlural/ingest",
};

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const { view, slug, file } = classify(url.pathname, req.headers);
  const host = ((req.headers.host || req.headers.Host || "") || "").toLowerCase();
  // Host-aware site naming: our family serves under their own name (the
  // crown agnt.in lands from Sedo transfer; until then fm/my/viiy are the
  // live hosts and must not advertise a domain that doesn't answer yet).
  const FAMILY = ["agnt.in", "ingest.fm", "ingest.my", "www.ingest.fm", "www.ingest.my"];
  const personal = host.endsWith("viiy.to");
  const siteName = FAMILY.includes(host) || personal ? host : SITE.name;

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
    const manifest = readPackageFile(slug, file || "INGEST.md");
    if (!manifest) return notFound(res, slug);
    res.writeHead(200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Access-Control-Allow-Origin": "*",
    });
    return res.end(manifest.text);
  }

  if (view === "og" || view === "card") {
    const manifest = readPackageFile(slug, "INGEST.md");
    if (!manifest) return notFound(res, slug);
    const cardPage = cardHTML(manifest, {
      ogOnly: view === "og",
      siteName,
      slug,
      origin: `https://${host}`,
    });
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
    const blob = readPackageFile(slug, file);
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    return res.end(blob.text);
  }

  // ── playground ────────────────────────────────────────────────
  if (view === TRY) {
    const origin = `https://${siteName}`;
    return html(tryHTML(origin, siteName));
  }

  // ── index ──────────────────────────────────────────────────────
  const slugs = listSlugs();
  return html(indexHTML(slugs, siteName));
};


// ── the post surface (v1.2): paste blocks on the card page ──────────
// Clicking the post loads the code; pasting the URL works all the same.
function pasteBlocks(slug, origin, repo) {
  const url = `${origin}/${slug}`;
  const r = repo || `https://github.com/MediaPlural/${slug}`;
  return `
<h2>Paste-ready (all equivalent)</h2>
<p><b>Terminal:</b></p>
<pre><code>git clone ${r} ~/${slug} && bash ~/${slug}/install.sh && python3 ~/${slug}/source.py &lt;target&gt; --full</code></pre>
<p><b>Any AI agent:</b></p>
<pre><code>Read ${url}/INGEST.md and execute its load order; it routes everything else.</code></pre>
<p><b>Claude Code / Cursor / OpenClaw / VS Code / Hermes:</b></p>
<pre><code>git clone ${r} ~/${slug} && bash ~/${slug}/install-everywhere.sh</code></pre>`;
}

// ── helpers ──────────────────────────────────────────────────────
function readPackageFile(slug, file) {
  if (!slug) return null;
  const safeSlug = String(slug).replace(/[^a-zA-Z0-9._-]/g, "");
  const safeFile = (file || "").replace(/[^a-zA-Z0-9._\/-]/g, "").replace(/\.+/g, ".").replace(/\/{2,}/g, "/");
  if (!safeSlug || !safeFile || safeFile.includes("..")) return null;
  const entry = PACKAGES[safeSlug];
  if (!entry) return null;
  const raw = entry[safeFile];
  if (raw == null) return null;
  const text = typeof raw === "string" && raw.startsWith("__b64__")
    ? Buffer.from(raw.slice(7), "base64").toString("utf8")
    : raw;
  return { text };
}

function listSlugs() {
  return Object.keys(PACKAGES);
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function notFound(res, slug, file) {
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>not found — agnt.in</title></head>
<body style="font-family:ui-monospace,monospace;background:#0d1117;color:#e6edf3;padding:8vh 24px">
<h2>404</h2><p>No package <code>${esc(slug || "")}</code>${file ? ` / <code>${esc(file)}</code>` : ""} here.</p>
<p><a style="color:#58a6ff" href="/">← agnt.in</a></p></body></html>`;
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

function cardHTML(m, { ogOnly = false, siteName, slug, origin } = {}) {
  const f = manifestFields(m.text);
  const canonical = m.text.includes("AGENT-INGEST.md") ? "INGEST.md" : "INGEST.md";
  // Absolute share URLs — relative links break at no-trailing-slash package URLs
  // (Reader-style proxies and LLMs follow links verbatim).
  const base = slug && origin ? `${origin}/${slug}` : "";
  const manifestHref = base ? `${base}/INGEST.md` : "./INGEST.md";
  const ogBlock = `
<meta property="og:title" content="${esc(f.title)}">
<meta property="og:description" content="${esc(f.bluf1)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(base)}">
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
  <div class="sub">A gest — a shareable package any agent can ingest · INGEST.md convention · ${esc(siteName)}</div>
  <div class="bluf">${esc(f.bluf)}</div>
  <div class="fp">sha256 fingerprint: ${esc(f.fp)}</div>
  <div class="fphint">verify after transfer — if it differs, the tree changed</div>
  <div class="oneliner">For your agent: <b>Read ${canonical} at the artifact root and execute its load order; it routes everything else.</b></div>
  ${pasteBlocks(slug, origin, "")}
  <div class="files">${f.files.map((x) => `${esc(x.path)} — ${esc(x.size)} bytes`).join("<br>")}</div>
  <p><a href="${manifestHref}">INGEST.md manifest →</a>${base ? ` · <a href="${base}/INGEST.md">absolute</a>` : ""} · <a href="${origin || "/"}">← host home</a></p>
</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(f.title)} — ${esc(siteName)}</title>${ogBlock}${style}
</head><body>${body}</body></html>`;
}

function tryHTML(origin, siteName) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>try — the INGEST.md playground</title>
<meta name="twitter:card" content="summary_large_image">
<meta property="og:title" content="INGEST.md playground — try the three-reader URL">
<meta property="og:description" content="One URL, three readers. See the classifier decide: crawlers get the unfurl, humans get the card, agents get the manifest.">
<style>
  body { margin:0; font-family:ui-monospace,Menlo,Consolas,monospace; background:#0d1117; color:#e6edf3; padding:8vh 6vw; line-height:1.7; }
  h1 { font-size:26px; } h2 { font-size:18px; color:#58a6ff; margin-top:40px; }
  pre { background:#161b22; border:1px solid #30363d; border-radius:10px; padding:16px 18px; overflow-x:auto; font-size:13px; }
  a { color:#58a6ff; text-decoration:none; }
  .note { color:#8b949e; font-size:13px; }
  table { border-collapse:collapse; margin-top:12px; font-size:14px; }
  td, th { border:1px solid #30363d; padding:7px 12px; }
  th { background:#161b22; }
</style>
</head><body>
<h1>try — the playground</h1>
<p>One URL, three readers. The classifier is deterministic and inspectable: <a href="https://github.com/MediaPlural/ingest/blob/main/api/lib/classify.js">api/lib/classify.js</a>.</p>

<h2>1 — the same URL, three ways</h2>
<table>
  <tr><th>You send</th><th>You get</th></tr>
  <tr><td><code>curl ${origin}/agentic-testing</code></td><td>the manifest (machine surface)</td></tr>
  <tr><td>a browser visit to <code>${origin}/agentic-testing</code></td><td>the card page (human surface)</td></tr>
  <tr><td>paste <code>${origin}/agentic-testing</code> into X / Discord / Slack</td><td>the unfurl (crawler surface — OG + twitter:card)</td></tr>
</table>

<h2>2 — try it from your terminal</h2>
<pre><code># the machine surface (an agent's view)
curl -A "curl/8.4" ${origin}/agentic-testing

# the human surface
open ${origin}/agentic-testing

# the crawler surface (what X/Discord fetch)
curl -A "Twitterbot/1.0" ${origin}/agentic-testing | head -20</code></pre>

<h2>3 — the one-liner, live</h2>
<pre><code>Read ${origin}/agentic-testing/INGEST.md and execute its load order; it routes everything else.</code></pre>
<p class="note">Your agent fetches the manifest, executes the load order, and the whole package routes from one line. That is the entire convention.</p>

<h2>4 — arm your own</h2>
<pre><code>git clone https://github.com/MediaPlural/ingest
cd ingest
python3 ingest.py init ./my-package --bluf bluf.txt
python3 tools/arm.py ./my-package --slug my-package --url ${origin}/my-package</code></pre>
<p class="note">The arming tool copies the artifact set into the host's packages/ dir and stamps the share URL. The manifest stays the single source of truth.</p>

<p><a href="/">← host home</a></p>
</body></html>`;
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