// embed.js — the INGEST.md embed widget (layer 3: "embed code was the share format
// of the social era; agent-ingest is the share format of the agentic era").
//
// USAGE (any site owner):
//   <div data-ingest="https://viiy.to/agentic-testing"></div>
//   <script src="https://HOST/embed.js"></script>
//
// The widget fetches the manifest, renders the card inline, and on click opens a
// sandbox-style modal: browse the artifact file-by-file (rendered from the
// manifest's file map), one-click install (zip download + OS-aware CLI prompt +
// copy-the-one-liner). Zero dependencies, one request, no build step.

(function () {
  "use strict";
  // SECURITY LAW for this file: every dynamic value interpolated into an
  // innerHTML template goes through esc() (below) — title, bluf, quip, paths,
  // sizes, URL, OS line. The templates themselves are static strings. No
  // event-handler strings are ever built from data. This is why the innerHTML
  // pattern is safe here; any new interpolation MUST go through esc().
  var script = (typeof document !== "undefined" && document.currentScript) || null;
  var ORIGIN = script ? script.src.replace(/\/embed\.js.*$/, "") : "";
  var q = function (sel) { return document.querySelector(sel); };

  // ── OS detection (the "windows vs mac vs linux" install prompt) ──
  function detectOS() {
    var ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    if (/Windows/i.test(ua)) return "windows";
    if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
    if (/Linux|X11/i.test(ua)) return "linux";
    if (/Android|iPhone|iPad/i.test(ua)) return "mobile";
    return "unknown";
  }
  var OS_LINES = {
    windows: 'powershell -c "irm https://github.com/MediaPlural/ingest/raw/main/ingest.py -OutFile ingest.py; python ingest.py verify <dir>"',
    mac: 'curl -O https://github.com/MediaPlural/ingest/raw/main/ingest.py && python3 ingest.py verify <dir>',
    linux: 'curl -O https://github.com/MediaPlural/ingest/raw/main/ingest.py && python3 ingest.py verify <dir>',
    mobile: "(on mobile: download the zip — install from a desktop)",
    unknown: "python3 ingest.py verify <dir>",
  };

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── manifest parsing (same shape the resolver uses) ──
  function parseManifest(text) {
    var fp = (text.match(/`([0-9a-f]{16})`/) || [])[1] || "";
    var title = (text.match(/^# INGEST\.md — machine manifest for `([^`]+)`/m) || [])[1] || "package";
    var bluf = (text.match(/## BLUF\s*\n\n([\s\S]+?)(?:\n\n## |$)/) || [])[1] || "";
    var quip = (text.match(/## Quip\s*\n\n> ?(.+)/) || [])[1] || "";
    var files = [];
    var re = /^- `([^`]+)` — ([\d,]+) bytes/gm, m2;
    while ((m2 = re.exec(text))) files.push({ path: m2[1], size: m2[2] });
    var vis = (text.match(/\*\*Visibility:\*\* ([a-z]+)/) || [])[1] || "unlisted";
    return { fp: fp, title: title, bluf: bluf.trim(), quip: quip, files: files, vis: vis };
  }

  // ── the inline card ──
  function cardHTML(pkg, url) {
    return '' +
      '<div class="ingest-card" style="max-width:620px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;border:1px solid #30363d;border-radius:12px;background:#0d1117;color:#e6edf3;overflow:hidden;cursor:pointer">' +
        '<div style="padding:16px 18px 12px">' +
          '<div style="font-size:15px;font-weight:600">' + esc(pkg.title) + '</div>' +
          '<div style="font-size:13px;color:#8b949e;margin-top:4px">' + esc(url) + ' · ' + pkg.files.length + ' files · ' + esc(pkg.vis) + '</div>' +
          (pkg.quip ? '<div style="font-size:13px;color:#79c0ff;margin-top:8px;font-style:italic">&gt; ' + esc(pkg.quip) + '</div>' : '') +
          '<div style="font-size:13.5px;line-height:1.55;color:#c9d1d9;margin-top:10px">' + esc(pkg.bluf.slice(0, 220)) + (pkg.bluf.length > 220 ? '…' : '') + '</div>' +
          '<div style="font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#58a6ff;margin-top:10px">sha256 ' + esc(pkg.fp) + '</div>' +
        '</div>' +
        '<div style="padding:10px 18px;border-top:1px solid #30363d;background:#161b22;font-size:12.5px;color:#8b949e">click to open the sandbox — browse + one-click install</div>' +
      '</div>';
  }

  // ── the sandbox modal ──
  function modalHTML(pkg, url, os) {
    var fileRows = pkg.files.map(function (f) {
      return '<div style="display:flex;justify-content:space-between;padding:7px 12px;border-bottom:1px solid #21262d;font-size:12.5px">' +
        '<span style="font-family:ui-monospace,Menlo,monospace;color:#c9d1d9">' + esc(f.path) + '</span>' +
        '<span style="color:#8b949e">' + esc(f.size) + ' B</span></div>';
    }).join("");
    return '' +
      '<div id="ingest-modal-back" style="position:fixed;inset:0;background:rgba(1,4,9,.72);backdrop-filter:blur(3px);z-index:2147483000;display:flex;align-items:center;justify-content:center">' +
        '<div style="width:min(720px,92vw);max-height:84vh;overflow:auto;background:#0d1117;border:1px solid #30363d;border-radius:14px;color:#e6edf3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">' +
          '<div style="position:sticky;top:0;background:#161b22;padding:14px 20px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-size:16px;font-weight:600">' + esc(pkg.title) + '</div>' +
            '<div style="font-size:12px;color:#8b949e;font-family:ui-monospace,Menlo,monospace">sha256 ' + esc(pkg.fp) + '</div></div>' +
            '<button id="ingest-close" style="background:none;border:1px solid #30363d;color:#e6edf3;border-radius:7px;padding:5px 12px;cursor:pointer">esc ✕</button>' +
          '</div>' +
          '<div style="padding:18px 20px">' +
            (pkg.quip ? '<div style="font-style:italic;color:#79c0ff;font-size:13.5px;margin-bottom:12px">&gt; ' + esc(pkg.quip) + '</div>' : '') +
            '<div style="font-size:13.5px;line-height:1.6;color:#c9d1d9">' + esc(pkg.bluf) + '</div>' +
            '<div style="margin-top:18px;font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:.05em">the artifact set</div>' +
            '<div style="margin-top:8px;border:1px solid #30363d;border-radius:10px;overflow:hidden">' + fileRows + '</div>' +
            '<div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">' +
              '<a id="ingest-zip" href="' + esc(url + '/archive.zip') + '" style="text-decoration:none;background:#238636;color:#fff;padding:10px 18px;border-radius:8px;font-size:13.5px;font-weight:600">⬇ Download .zip</a>' +
              '<button id="ingest-copy" style="background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:10px 18px;border-radius:8px;font-size:13.5px;cursor:pointer">⧉ Copy the one-liner</button>' +
              '<a href="' + esc(url) + '" target="_blank" style="text-decoration:none;background:none;border:1px solid #30363d;color:#58a6ff;padding:10px 18px;border-radius:8px;font-size:13.5px">Open share page ↗</a>' +
            '</div>' +
            '<div style="margin-top:18px;font-size:12px;color:#8b949e">install for ' + esc(os) + ':</div>' +
            '<pre id="ingest-cli" style="margin-top:6px;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px 14px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#e6edf3;overflow-x:auto">' + esc(OS_LINES[os]) + '</pre>' +
            '<div style="font-size:12px;color:#8b949e;margin-top:12px">Then verify: <span style="font-family:ui-monospace,Menlo,monospace;color:#58a6ff">ingest verify &lt;unzipped-dir&gt;</span> — exit 0 = the bytes are intact (fingerprint ' + esc(pkg.fp) + ').</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ── boot ──
  function boot() {
    var hosts = document.querySelectorAll("[data-ingest]");
    Array.prototype.forEach.call(hosts, function (el) {
      var url = (el.getAttribute("data-ingest") || "").replace(/\/$/, "");
      if (!url) return;
      fetch(url + "/INGEST.md").then(function (r) { return r.text(); }).then(function (text) {
        var pkg = parseManifest(text);
        el.innerHTML = cardHTML(pkg, url);
        el.querySelector(".ingest-card").addEventListener("click", function (ev) {
          ev.preventDefault();
          var os = detectOS();
          var wrap = document.createElement("div");
          wrap.innerHTML = modalHTML(pkg, url, os);
          document.body.appendChild(wrap);
          document.body.style.overflow = "hidden";
          wrap.querySelector("#ingest-close").addEventListener("click", function () {
            wrap.remove(); document.body.style.overflow = "";
          });
          wrap.querySelector("#ingest-modal-back").addEventListener("click", function (e) {
            if (e.target === this) { wrap.remove(); document.body.style.overflow = ""; }
          });
          var copyBtn = wrap.querySelector("#ingest-copy");
          if (copyBtn) copyBtn.addEventListener("click", function () {
            var line = "Read INGEST.md at " + url + "/INGEST.md and execute its load order; it routes everything else.";
            if (navigator.clipboard) navigator.clipboard.writeText(line);
            copyBtn.textContent = "✓ Copied";
          });
          document.addEventListener("keydown", function esc2(e) {
            if (e.key === "Escape") { wrap.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", esc2); }
          });
        });
      }).catch(function () {
        el.innerHTML = '<div style="border:1px solid #30363d;border-radius:10px;padding:14px;background:#0d1117;color:#8b949e;font-size:13px;font-family:monospace">ingest embed: could not reach ' + esc(url) + '</div>';
      });
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  // Node test hook — parseManifest/detectOS are pure functions; test them
  // without a DOM (tests/embed-parse.test.js). Browser flow is untouched.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseManifest: parseManifest, detectOS: detectOS, esc: esc, OS_LINES: OS_LINES };
  }
})();