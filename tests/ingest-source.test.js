// tests/ingest-source.test.js — the source lane: four classes, real subprocess runs,
// real receipts, no network.
//
// Style note (matching tests/zip.test.js): argument ARRAYS via spawnSync, never a
// shell string — no shell, no injection surface; the only dynamic values are our
// own mkdtemp paths. spawnSync (not execFileSync) because half these cases assert
// on a NON-ZERO exit: the tool's contract is that a bad source exits 2 with a
// reason and writes nothing, and an exception-throwing helper cannot assert that.
//
// No network in this suite by design (the repo's CI rule). The tool's live-fetch
// path is exercised by the opt-in case at the bottom, which is skipped unless
// INGEST_SOURCE_LIVE=1 — so CI stays hermetic and an operator can still prove the
// network path on demand.
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const TOOL = path.join(ROOT, "tools", "ingest-source.py");
const CORE = path.join(ROOT, "ingest.py");
const NOW = "2026-10-10T12:00:00+00:00";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Fixture Feed</title>
  <item><title>First Post</title><link>https://example.com/a</link><pubDate>Tue, 07 Oct 2026 10:00:00 GMT</pubDate>
    <description>Alpha body text about manifests.</description></item>
  <item><title>Second Post</title><link>https://example.com/b</link><pubDate>Wed, 08 Oct 2026 10:00:00 GMT</pubDate>
    <description>Beta body text about fingerprints.</description></item>
</channel></rss>
`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Fixture</title>
  <entry><title>Atom One</title><link href="https://example.org/1"/><updated>2026-10-01T00:00:00Z</updated>
    <summary>Atom summary one.</summary></entry>
  <entry><title>Atom Two</title><link href="https://example.org/2"/><updated>2026-10-02T00:00:00Z</updated>
    <summary>Atom summary two.</summary></entry>
</feed>
`;

// An XML payload carrying an external-entity declaration: the tool must refuse it
// outright, and must never resolve the entity (here: a file that exists on the runner).
const DTD = `<?xml version="1.0"?>
<!DOCTYPE rss [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>
<rss version="2.0"><channel><item><title>&xxe;</title><description>boom</description></item></channel></rss>
`;

const JSON_API = JSON.stringify({
  items: [
    { title: "JSON One", url: "https://api.example.com/1", published_at: "2026-09-30", content: "First JSON item body." },
    { title: "JSON Two", url: "https://api.example.com/2", published_at: "2026-10-01", content: "Second JSON item body." },
  ],
});

const COLLIDE = JSON.stringify([
  { title: "Same Title", url: "https://x.example/1", text: "one" },
  { title: "Same Title", url: "https://x.example/2", text: "two" },
]);

function run(script, args) {
  return spawnSync("python3", [script, ...args], { encoding: "utf8" });
}

function fetch(args) {
  return run(TOOL, args);
}

function receipt(dir) {
  const p = path.join(dir, "SOURCES.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sha256(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ingest-source-"));
}

test("dir: copies the tree (shape preserved) and writes a receipt", () => {
  const tmp = tmpdir();
  const src = path.join(tmp, "src");
  fs.mkdirSync(path.join(src, "sub"), { recursive: true });
  fs.writeFileSync(path.join(src, "a.txt"), "alpha\n");
  fs.writeFileSync(path.join(src, "sub", "b.txt"), "beta\n");
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "dir", "--from", src, "--out", out, "--now", NOW]);
  assert.equal(r.status, 0, r.stderr);
  const rec = receipt(out);
  assert.equal(rec.item_count, 2);
  assert.ok(fs.existsSync(path.join(out, "sub", "b.txt")), "tree shape preserved");
});

test("json: items materialize with front-matter, and the receipt hashes match the files", () => {
  const tmp = tmpdir();
  const api = path.join(tmp, "api.json");
  fs.writeFileSync(api, JSON_API);
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "json", "--from", api, "--out", out, "--now", NOW]);
  assert.equal(r.status, 0, r.stderr);
  const rec = receipt(out);
  assert.equal(rec.item_count, 2);
  const first = fs.readdirSync(out).find((n) => n.startsWith("json-one-"));
  assert.ok(first, "an item file is named from its title");
  const body = fs.readFileSync(path.join(out, first), "utf8");
  assert.match(body, /source_url: "https:\/\/api\.example\.com\/1"/);
  assert.equal(rec.items[0].sha256, sha256(path.join(out, first)), "receipt hash == file hash");
});

test("rss 2.0: entries parsed with titles, links and dates", () => {
  const tmp = tmpdir();
  const feed = path.join(tmp, "feed.xml");
  fs.writeFileSync(feed, RSS);
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "rss", "--from", feed, "--out", out, "--now", NOW]);
  assert.equal(r.status, 0, r.stderr);
  const rec = receipt(out);
  assert.equal(rec.item_count, 2);
  assert.ok(rec.items.some((i) => i.file.startsWith("first-post-")));
  assert.ok(rec.items.every((i) => i.origin.startsWith("https://example.com/")));
});

test("atom: entries parsed despite the namespace", () => {
  const tmp = tmpdir();
  const atom = path.join(tmp, "atom.xml");
  fs.writeFileSync(atom, ATOM);
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "rss", "--from", atom, "--out", out, "--now", NOW]);
  assert.equal(r.status, 0, r.stderr);
  const rec = receipt(out);
  assert.equal(rec.item_count, 2);
  assert.ok(rec.items.some((i) => i.file.startsWith("atom-one-")));
});

test("determinism: same --now and same --out re-runs byte-identical (idempotent)", () => {
  const tmp = tmpdir();
  const feed = path.join(tmp, "feed.xml");
  fs.writeFileSync(feed, RSS);
  const out = path.join(tmp, "det");
  const args = ["fetch", "--source", "rss", "--from", feed, "--out", out, "--now", NOW];
  assert.equal(fetch(args).status, 0);
  const nameHashes = () => Object.fromEntries(
    fs.readdirSync(out).map((n) => [n, sha256(path.join(out, n))]));
  const before = nameHashes();
  assert.equal(fetch(args).status, 0);
  assert.deepEqual(nameHashes(), before, "re-fetch into the same dir changes nothing");
});

test("determinism: content is byte-identical across --out; only the receipt's log fields differ", () => {
  const tmp = tmpdir();
  const feed = path.join(tmp, "feed.xml");
  fs.writeFileSync(feed, RSS);
  const a = path.join(tmp, "a");
  const b = path.join(tmp, "b");
  assert.equal(fetch(["fetch", "--source", "rss", "--from", feed, "--out", a, "--now", NOW]).status, 0);
  assert.equal(fetch(["fetch", "--source", "rss", "--from", feed, "--out", b, "--now", NOW]).status, 0);
  const content = (d) => fs.readdirSync(d).filter((n) => n !== "SOURCES.json").sort();
  assert.deepEqual(content(a), content(b));
  for (const n of content(a)) {
    assert.equal(sha256(path.join(a, n)), sha256(path.join(b, n)), `${n} content differs`);
  }
  const ra = receipt(a);
  const rb = receipt(b);
  delete ra.out;
  delete rb.out;
  assert.deepEqual(ra, rb, "receipts agree once the output path is factored out");
});

test("collisions: two items with the same title get distinct files (nothing overwritten)", () => {
  const tmp = tmpdir();
  const col = path.join(tmp, "col.json");
  fs.writeFileSync(col, COLLIDE);
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "json", "--from", col, "--out", out, "--now", NOW]);
  assert.equal(r.status, 0, r.stderr);
  const rec = receipt(out);
  assert.equal(rec.item_count, 2);
  assert.equal(new Set(rec.items.map((i) => i.file)).size, 2);
});

test("negative: a missing locator exits 2 with a reason and writes nothing", () => {
  const tmp = tmpdir();
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "rss", "--from", path.join(tmp, "nope.xml"), "--out", out, "--now", NOW]);
  assert.equal(r.status, 2);
  assert.match(r.stdout + r.stderr, /locator not found/);
  assert.equal(receipt(out), null);
});

test("negative: XML with a DTD/entity is refused — and the entity is never resolved", () => {
  const tmp = tmpdir();
  const bomb = path.join(tmp, "bomb.xml");
  fs.writeFileSync(bomb, DTD);
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "rss", "--from", bomb, "--out", out, "--now", NOW]);
  assert.equal(r.status, 2);
  assert.match(r.stdout + r.stderr, /refused/);
  const written = fs.existsSync(out) ? fs.readdirSync(out) : [];
  assert.deepEqual(written, [], "no item files from a refused payload");
});

test("negative: an unusable payload exits 2 and leaves no receipt", () => {
  const tmp = tmpdir();
  const bad = path.join(tmp, "bad.json");
  fs.writeFileSync(bad, JSON.stringify({ unexpected: 1 }));
  const out = path.join(tmp, "out");
  const r = fetch(["fetch", "--source", "json", "--from", bad, "--out", out, "--now", NOW]);
  assert.equal(r.status, 2);
  assert.equal(receipt(out), null);
});

test("composition: fetch -> ingest init -> ingest verify OK, then tamper -> MISMATCH", () => {
  const tmp = tmpdir();
  const api = path.join(tmp, "api.json");
  fs.writeFileSync(api, JSON_API);
  const bluf = path.join(tmp, "bluf.md");
  fs.writeFileSync(bluf, "A fixture package materialized by the source lane, then armed and verified by the core CLI.\n");
  const pkg = path.join(tmp, "pkg");
  assert.equal(fetch(["fetch", "--source", "json", "--from", api, "--out", pkg, "--now", NOW]).status, 0);

  const init = run(CORE, ["init", pkg, "--bluf", bluf, "--visibility", "public"]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const verify = run(CORE, ["verify", pkg]);
  assert.equal(verify.status, 0, verify.stdout + verify.stderr);
  assert.match(verify.stdout, /^OK:/m);

  // the fingerprint is load-bearing: one changed byte must flip verify to MISMATCH
  const target = fs.readdirSync(pkg).find((n) => n.startsWith("json-"));
  fs.writeFileSync(path.join(pkg, target), "tampered\n");
  const verify2 = run(CORE, ["verify", pkg]);
  assert.equal(verify2.status, 2);
  assert.match(verify2.stdout, /MISMATCH/);
});

test("opt-in live fetch (INGEST_SOURCE_LIVE=1): a real feed over the network", { skip: process.env.INGEST_SOURCE_LIVE !== "1" }, () => {
  const tmp = tmpdir();
  const out = path.join(tmp, "live");
  const r = fetch(["fetch", "--source", "rss", "--from", "https://simonwillison.net/atom/everything/",
    "--out", out, "--limit", "3", "--now", NOW]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(receipt(out).item_count, 3);
});
