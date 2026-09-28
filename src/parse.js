import * as cheerio from "cheerio";

function inlineHtml($, el) {
  const $clone = $(el).clone();
  $clone.find("a.footnote-anchor").each((_, a) => {
    const $a = $(a);
    $a.replaceWith(`<sup class="fn-ref">${$a.text().trim()}</sup>`);
  });
  $clone.find("a").each((_, a) => {
    const $a = $(a);
    $a.replaceWith(`<span class="inline-link">${$a.html()}</span>`);
  });
  return $clone.html().trim();
}

export function parseArticle(bodyHtml) {
  const $ = cheerio.load(bodyHtml, null, false);
  const root = $.root();

  const blocks = [];
  const footnotes = [];

  root.children().each((_, el) => {
    const $el = $(el);
    const tag = el.tagName ? el.tagName.toLowerCase() : "";

    const className = String($el.attr("class") || "");
    const componentName = String($el.attr("data-component-name") || "");
    if (
      /subscription-widget|subscribe-widget|cta-caption/i.test(className) ||
      /subscribe(widget|button)/i.test(componentName) ||
      $el.find(".subscription-widget, .subscription-widget-subscribe, .cta-caption").length
    ) {
      return;
    }

    if (tag === "div" && $el.attr("class") && $el.attr("class").includes("footnote")) {
      const number = $el.find(".footnote-number").first().text().trim();
      const html = inlineHtml($, $el.find(".footnote-content").first());
      if (html) footnotes.push({ number: number || String(footnotes.length + 1), html });
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const text = $el.text().trim();
      if (text) blocks.push({ type: "heading", level: Number(tag[1]), text });
      return;
    }

    if (
      tag === "p" &&
      ($el.attr("class") || "").includes("button-wrapper")
    ) {
      return;
    }

    if (tag === "p") {
      const html = inlineHtml($, $el);
      if (html && $el.text().trim()) blocks.push({ type: "paragraph", html });
      return;
    }

    if (tag === "blockquote") {
      const html = inlineHtml($, $el);
      if (html) blocks.push({ type: "quote", html });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = [];
      $el.find("> li").each((__, li) => {
        const html = inlineHtml($, $(li));
        if (html) items.push(html);
      });
      if (items.length) blocks.push({ type: "list", ordered: tag === "ol", items });
      return;
    }

    if (tag === "hr") {
      blocks.push({ type: "divider" });
      return;
    }

    const nestedImg = tag === "img" ? $el : $el.find("img").first();
    if (nestedImg && nestedImg.length) {
      let src = nestedImg.attr("src") || "";
      const dataAttrs = nestedImg.attr("data-attrs");
      if (dataAttrs) {
        try {
          const parsed = JSON.parse(dataAttrs.replace(/&quot;/g, '"'));
          if (parsed.src) src = parsed.src;
        } catch {
        }
      }
      const width = Number(nestedImg.attr("width")) || null;
      const height = Number(nestedImg.attr("height")) || null;
      const captionEl = $el.find("figcaption, .image-caption").first();
      const caption = captionEl.length ? captionEl.text().trim() : "";
      if (src) {
        blocks.push({ type: "figure", src, width, height, caption });
        return;
      }
    }

    const text = $el.text().trim();
    if (text) blocks.push({ type: "paragraph", html: inlineHtml($, $el) });
  });

  footnotes.sort((a, b) => Number(a.number) - Number(b.number));

  return { blocks, footnotes };
}
