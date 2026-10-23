import type { APIRoute } from "astro";

const defaultPath = 'sitemap-index.xml';
const allowed = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Google-CloudVertexBot",
  "MistralAI-User",
  "DuckAssistBot",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "CCBot",
] as const;

const disallowed = [
  "OAI-AdsBot",
  "meta-externalagent",
  "cohere-ai",
] as const;

const getRobotsTxt = (sitemapURL: URL) => `\
# Global rules
User-agent: *
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=yes

# AI bots - Allowed
${allowed.map((bot) => `User-agent: ${bot}\nAllow: /`).join("\n\n")}

# AI bots - Blocked
${disallowed.map((bot) => `User-agent: ${bot}\nDisallow: /`).join("\n\n")}

Sitemap: ${sitemapURL.href}
`.trim();

export const GET: APIRoute = ({ site }) => {
    if (!site) {
        return new Response("Missing site configuration", {
            status: 500,
        });
    }

    const sitemapURL = new URL(defaultPath, site);

    return new Response(getRobotsTxt(sitemapURL), {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        }
    });
};