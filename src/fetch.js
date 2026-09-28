const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function parseSubstackUrl(rawUrl) {
  const url = new URL(rawUrl);

  const pubMatch = url.pathname.match(/\/pub\/([^/]+)\/p\/([^/?#]+)/);
  if (pubMatch) {
    return { base: `https://${pubMatch[1]}.substack.com`, slug: pubMatch[2] };
  }

  const pMatch = url.pathname.match(/\/p\/([^/?#]+)/);
  if (
    pMatch &&
    url.hostname !== "substack.com" &&
    url.hostname !== "www.substack.com" &&
    url.hostname !== "open.substack.com"
  ) {
    return { base: `${url.protocol}//${url.hostname}`, slug: pMatch[1] };
  }

  return null;
}

async function resolveToArticleUrl(rawUrl) {
  const direct = parseSubstackUrl(rawUrl);
  if (direct) return rawUrl;

  const res = await fetch(rawUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Failed to fetch ${rawUrl}: HTTP ${res.status}`);
  const html = await res.text();

  const og = html.match(/<meta property="og:url" content="([^"]+)"/);
  if (og) return og[1];

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (canonical) return canonical[1];

  throw new Error("Could not resolve this link to a Substack article (/p/<slug>) URL.");
}

export async function fetchArticle(rawUrl) {
  const articleUrl = await resolveToArticleUrl(rawUrl);
  const parsed = parseSubstackUrl(articleUrl);
  if (!parsed) {
    throw new Error(`This does not look like a Substack article URL: ${articleUrl}`);
  }

  const apiUrl = `${parsed.base}/api/v1/posts/${parsed.slug}`;
  const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`Failed to fetch article data from ${apiUrl}: HTTP ${res.status}`);
  }
  const data = await res.json();

  if (!data.body_html) {
    throw new Error(
      "This post has no readable body (it may be paywalled, or a podcast/video-only post)."
    );
  }

  const author =
    (data.publishedBylines && data.publishedBylines[0] && data.publishedBylines[0].name) ||
    (data.byline && data.byline.name) ||
    parsed.base.replace(/^https?:\/\//, "").replace(/\.substack\.com$/, "");

  return {
    title: data.title || "",
    subtitle: data.subtitle || "",
    author,
    coverImage: data.cover_image || data.social_title_image || null,
    postDate: data.post_date || null,
    canonicalUrl: data.canonical_url || articleUrl,
    publicationBase: parsed.base,
    slug: parsed.slug,
    bodyHtml: data.body_html,
  };
}
