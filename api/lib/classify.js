// classify.js — the request classifier (pure, testable).
// One URL, three readers: crawlers get OG, agents get the manifest, humans get the card.
// Protocol first (Accept negotiation), UA second (the unfurl-industry necessity).

const MANIFEST_NAMES = ["INGEST.md", "AGENT-INGEST.md"];

// Social unfurl + search crawlers render the card (OG tags). Keep the list boring and factual.
const CARD_UAS = [
  "facebookexternalhit", "Twitterbot", "Slbot", "Slack", "Discord", "WhatsApp",
  "LinkedInBot", "TelegramBot", "SkypeUriPreview", "Googlebot", "bingbot",
  "Applebot", "Pinterestbot", "Twitterbot/1.0",
];

// Scripted fetchers and agent clients get the machine surface.
const AGENT_UAS = [
  "curl", "Wget", "wget", "python-requests", "python-httpx", "httpx", "node-fetch",
  "undici", "axios", "Go-http-client", "libwww", "java/", "okhttp",
  "OpenAI", "ChatGPT", "Anthropic", "Claude", "GPT", "Perplexity", "perplexity",
  "PerplexityBot", "YouBot", "Amazonbot", "SemrushBot", "AhrefsBot", "DotBot",
  "feedparser", "UniversalFeedParser",
];

const MANIFEST = "manifest";   // serve INGEST.md as text/markdown
const CARD = "card";           // serve the human card page
const OG = "og";               // serve the unfurl page (full OG + twitter:card)
const INDEX = "index";         // host home
const TRY = "try";             // playground

function isCardCrawler(ua) {
  return CARD_UAS.some((c) => ua.includes(c));
}

function isAgentFetcher(ua) {
  if (!ua) return true; // no UA = scripted fetch — the machine surface
  return AGENT_UAS.some((a) => ua.includes(a));
}

function looksLikeBrowser(ua) {
  return /Mozilla\/5\.0/.test(ua) && !isCardCrawler(ua) && !isAgentFetcher(ua);
}

/**
 * classify(pathname, headers) -> { view, slug, file }
 *   view: manifest | card | og | index | try
 * Order of decisions:
 *   1. Route shape (/, /try, /<slug>, /<slug>/<file>)
 *   2. Protocol: Accept: text/markdown → manifest; manifest paths → manifest
 *   3. Known card crawlers → og
 *   4. Agent fetchers → manifest; everyone else → card
 */
function classify(pathname, headers) {
  const ua = (headers["user-agent"] || headers["User-Agent"] || "").toString();
  const accept = (headers["accept"] || headers["Accept"] || "").toString();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return { view: INDEX, slug: null, file: null };
  if (parts[0] === "try") return { view: TRY, slug: null, file: null };

  const slug = parts[0];
  const file = parts.slice(1).join("/") || null;

  // The manifest paths are the machine surface, always.
  if (file && MANIFEST_NAMES.includes(file)) return { view: MANIFEST, slug, file };
  // Protocol-first negotiation: anything asking for markdown gets the manifest.
  if (!file && accept.includes("text/markdown")) return { view: MANIFEST, slug, file };

  if (!file) {
    if (isCardCrawler(ua)) return { view: OG, slug, file };
    if (isAgentFetcher(ua) && !looksLikeBrowser(ua)) return { view: MANIFEST, slug, file };
    return { view: CARD, slug, file };
  }
  return { view: "file", slug, file };
}

module.exports = {
  classify,
  isCardCrawler,
  isAgentFetcher,
  looksLikeBrowser,
  MANIFEST,
  CARD,
  OG,
  INDEX,
  TRY,
  MANIFEST_NAMES,
};