import { CONTENT_WIDTH, DEFAULT_PROFILE, baseCss } from "./layout.js";
import { renderBlock, renderFootnoteItem } from "./blocks.js";

export async function measureBlockHeights(page, blocks, profile = DEFAULT_PROFILE) {
  const inner = blocks
    .map((b, i) => `<div class="measure-item" data-i="${i}">${renderBlock(b)}</div>`)
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${baseCss(profile)}
  body { width: ${CONTENT_WIDTH}px; }
  .measure-item { width: 100%; }
</style></head>
<body>${inner}</body></html>`;

  await page.setContent(html, { waitUntil: "load" });
  await waitForImages(page);

  const heights = await page.$$eval(".measure-item", (els) =>
    els.map((el) => el.getBoundingClientRect().height)
  );
  return heights;
}

export async function measureFootnoteHeights(page, footnotes, profile = DEFAULT_PROFILE) {
  const inner = footnotes
    .map((f, i) => `<div class="measure-item" data-i="${i}">${renderFootnoteItem(f)}</div>`)
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${baseCss(profile)}
  body { width: ${CONTENT_WIDTH}px; }
  .measure-item { width: 100%; }
</style></head>
<body>${inner}</body></html>`;

  await page.setContent(html, { waitUntil: "load" });

  const heights = await page.$$eval(".measure-item", (els) =>
    els.map((el) => el.getBoundingClientRect().height)
  );
  return heights;
}

async function waitForImages(page) {
  await Promise.race([
    page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              })
        )
      );
    }),
    new Promise((resolve) => setTimeout(resolve, 15000)),
  ]);
}
