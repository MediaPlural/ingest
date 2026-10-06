// tests/classify.test.js — the resolver's classification is the contract.
// Run: node --test tests/classify.test.js

const { test } = require("node:test");
const assert = require("node:assert");
const { classify } = require("../api/lib/classify.js");

// ── route shape ──────────────────────────────────────────────
test("bare host root = index", () => {
  assert.equal(classify("/", {}).view, "index");
});
test("/try = playground", () => {
  assert.equal(classify("/try", {}).view, "try");
});

// ── the three readers, one URL ───────────────────────────────
test("card crawlers get the OG unfurl view", () => {
  for (const ua of ["Twitterbot/1.0", "facebookexternalhit/1.1", "Discord", "Slack", "TelegramBot", "LinkedInBot"]) {
    assert.equal(classify("/pkg", { "user-agent": ua }).view, "og", ua);
  }
});
test("agent fetchers get the manifest", () => {
  for (const ua of ["curl/8.4", "Wget/1.21", "python-requests/2.31", "OpenAI", "Anthropic"]) {
    assert.equal(classify("/pkg", { "user-agent": ua }).view, "manifest", ua);
  }
});
test("browsers get the card page", () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
  assert.equal(classify("/pkg", { "user-agent": ua }).view, "card");
});
test("no UA at all = the machine surface (scripted fetch)", () => {
  assert.equal(classify("/pkg", {}).view, "manifest");
});

// ── protocol first ───────────────────────────────────────────
test("Accept: text/markdown negotiates the manifest, even from a browser UA", () => {
  const ua = "Mozilla/5.0 (Macintosh) Safari";
  assert.equal(classify("/pkg", { "user-agent": ua, accept: "text/markdown" }).view, "manifest");
});
test("explicit manifest paths are always the manifest", () => {
  assert.equal(classify("/pkg/INGEST.md", { "user-agent": "Mozilla/5.0 Safari" }).view, "manifest");
  assert.equal(classify("/pkg/AGENT-INGEST.md", { "user-agent": "Twitterbot" }).view, "manifest");
});

// ── files inside the package ─────────────────────────────────
test("package files route as files", () => {
  assert.equal(classify("/pkg/data/report.md", {}).view, "file");
});

// ── the personal-host difference: viiy.to must NOT leak into the public convention ──
test("no package name leaks viiy branding into the public host", () => {
  // the classifier is identical for both hosts; host identity is env-only
  const { SITE_NAME } = process;
  assert.ok(!JSON.stringify(classify("/pkg", {})).includes("viiy"));
});