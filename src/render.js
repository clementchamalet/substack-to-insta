import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import {
  CANVAS,
  COLORS,
  FONTS,
  baseCss,
  CONTENT_MAX_HEIGHT,
  DEFAULT_PROFILE,
  makeProfile,
} from "./layout.js";
import { renderBlock, renderFootnoteItem } from "./blocks.js";
import { measureBlockHeights, measureFootnoteHeights } from "./measure.js";
import { paginateFlow, paginateFootnotes } from "./paginate.js";
import { splitTextBlockToFit } from "./split.js";
import { CONTENT_WIDTH } from "./layout.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function handleFromBase(base) {
  return base.replace(/^https?:\/\//, "").replace(/\.substack\.com$/, "");
}

function titleFontSize(title) {
  const len = title.length;
  if (len <= 30) return 72;
  if (len <= 50) return 60;
  if (len <= 80) return 50;
  return 42;
}

function coverExtraCss() {
  return `
    .canvas.cover { justify-content: flex-end; background-color: ${COLORS.ink}; }
    .cover-top {
      position: absolute; top: 56px; left: 64px; right: 64px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .cover-kicker {
      font-family: ${FONTS.sans}; font-size: 22px; letter-spacing: 0.16em;
      text-transform: uppercase; color: rgba(255,255,255,0.92); font-weight: 700;
    }
    .cover-badge {
      font-family: ${FONTS.sans}; font-size: 18px; letter-spacing: 0.1em;
      color: rgba(255,255,255,0.75); text-transform: uppercase;
    }
    .cover-bottom { padding: 0 64px 68px 64px; }
    .cover-title {
      font-family: ${FONTS.serif}; font-weight: 700; color: #FBF7EE;
      line-height: 1.12; letter-spacing: -0.01em; margin-bottom: 22px;
    }
    .cover-subtitle {
      font-family: ${FONTS.serif}; font-style: italic; font-size: 32px;
      color: rgba(251,247,238,0.88); line-height: 1.4; margin-bottom: 30px;
      max-width: 880px;
    }
    .cover-meta {
      display: flex; align-items: center; gap: 12px;
      font-family: ${FONTS.sans}; font-size: 21px; letter-spacing: 0.04em;
      color: rgba(251,247,238,0.85);
    }
    .cover-meta .dot { color: ${COLORS.accentSoft}; }
    .cover-rule { width: 64px; height: 3px; background: ${COLORS.accent}; margin-bottom: 24px; }
  `;
}

function buildCoverHtml(article, totalSlides) {
  const handle = handleFromBase(article.publicationBase);
  const dateLabel = formatDate(article.postDate);
  const bg = article.coverImage
    ? `linear-gradient(180deg, rgba(18,14,10,0.10) 0%, rgba(18,14,10,0.30) 38%, rgba(13,10,7,0.90) 76%, rgba(10,8,6,0.96) 100%), url('${article.coverImage}')`
    : `linear-gradient(160deg, ${COLORS.ink}, #33291F)`;

  const body = `
    <div class="canvas cover" style="background-image: ${bg}; background-size: cover; background-position: center;">
      <div class="cover-top">
        <span class="cover-kicker">${handle}</span>
        <span class="cover-badge">1 / ${totalSlides}</span>
      </div>
      <div class="cover-bottom">
        <div class="cover-rule"></div>
        <div class="cover-title" style="font-size:${titleFontSize(article.title)}px;">${escapeHtml(
    article.title
  )}</div>
        ${
          article.subtitle
            ? `<div class="cover-subtitle">${escapeHtml(article.subtitle)}</div>`
            : ""
        }
        <div class="cover-meta">
          <span>${escapeHtml(article.author)}</span>
          ${dateLabel ? `<span class="dot">&middot;</span><span>${dateLabel}</span>` : ""}
        </div>
      </div>
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()}${coverExtraCss()}</style></head><body>${body}</body></html>`;
}

function buildContentSlideHtml({ kicker, pageLabel, footerLabel, blocksHtml, profile }) {
  const body = `
    <div class="canvas content-canvas">
      <div class="chrome-header">
        <span class="kicker">${escapeHtml(kicker)}</span>
        <span class="page-index">${pageLabel}</span>
      </div>
      <div class="content">${blocksHtml}</div>
      <div class="chrome-footer">
        <span class="footer-label">${escapeHtml(footerLabel)}</span>
      </div>
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(profile)}</style></head><body>${body}</body></html>`;
}

const PROFILE_LADDER = [
  ...[1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76].map((s) => makeProfile(s)),
  makeProfile(0.76, { headingBreak: false }),
  makeProfile(0.72, { headingBreak: false }),
];

async function layoutForProfile(measurePage, parsed, profile) {
  const rawHeights = await measureBlockHeights(measurePage, parsed.blocks, profile);
  const contentPages = await paginateFlow(measurePage, parsed.blocks, rawHeights, { profile });

  let footnotePages = [];
  let expandedFootnotes = [];
  if (parsed.footnotes.length) {
    const rawFnHeights = await measureFootnoteHeights(measurePage, parsed.footnotes, profile);
    const fnResult = await expandOversizedFootnotes(
      measurePage,
      parsed.footnotes,
      rawFnHeights,
      profile
    );
    expandedFootnotes = fnResult.footnotes;
    footnotePages = paginateFootnotes(
      expandedFootnotes,
      fnResult.heights,
      CONTENT_MAX_HEIGHT,
      profile.fnGap
    );
  }

  return {
    profile,
    contentPages,
    footnotePages,
    expandedFootnotes,
    total: 1 + contentPages.length + footnotePages.length,
  };
}

function describeProfile(profile) {
  const pct = Math.round(profile.scale * 100);
  return `${pct}% text size${profile.headingBreak ? "" : ", headings flow inline"}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function renderSlides(article, parsed, outDir, opts = {}) {
  const maxSlides = opts.maxSlides ?? 20;
  const lastBlockIndex = parsed.blocks.length - 1;
  const renderParsed = {
    ...parsed,
    blocks: parsed.blocks.map((block, index) =>
      index === lastBlockIndex && block.type === "figure"
        ? { ...block, closing: true }
        : block
    ),
  };
  await fs.mkdir(outDir, { recursive: true });
  for (const f of await fs.readdir(outDir)) {
    if (/^\d\d-(cover|slide|notes)\.png$/.test(f)) await fs.rm(path.join(outDir, f));
  }

  const browser = await chromium.launch();
  const measurePage = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
  const shotPage = await browser.newPage({
    viewport: { width: CANVAS, height: CANVAS },
    deviceScaleFactor: 2,
  });

  measurePage.on("console", (msg) => process.stderr.write(`  [page console] ${msg.text()}\n`));
  shotPage.on("console", (msg) => process.stderr.write(`  [page console] ${msg.text()}\n`));

  try {
    let layout = null;
    for (const profile of PROFILE_LADDER) {
      process.stderr.write(`  layout attempt: ${describeProfile(profile)}… `);
      layout = await layoutForProfile(measurePage, renderParsed, profile);
      process.stderr.write(`${layout.total} slides\n`);
      if (layout.total <= maxSlides) break;
    }
    if (layout.total > maxSlides) {
      process.stderr.write(
        `  ! WARNING: even the densest layout needs ${layout.total} slides (limit ${maxSlides}) — the article is too long to fit at a readable size.\n`
      );
    }
    const { profile, contentPages, footnotePages, expandedFootnotes } = layout;

    const totalSlides = layout.total;
    const handle = handleFromBase(article.publicationBase);
    const footerLabel = `${handle}.substack.com`;
    const files = [];

    process.stderr.write("  rendering cover…\n");
    await shotPage.setContent(buildCoverHtml(article, totalSlides), { waitUntil: "load" });
    await waitForImages(shotPage);
    await shotPage.waitForTimeout(200); // let the CSS background-image paint
    let file = path.join(outDir, `01-cover.png`);
    await shotPage.locator(".canvas").screenshot({ path: file, timeout: 20000 });
    files.push(file);
    process.stderr.write("  cover done\n");

    let slideNum = 2;
    let currentSectionTitle = article.title;
    for (const pageBlocks of contentPages) {
      const firstHeading = pageBlocks.find((b) => b.type === "heading" && (b.level || 3) <= 4);
      if (firstHeading) currentSectionTitle = firstHeading.text;

      const blocksHtml = pageBlocks.map((b) => renderBlock(b)).join("");
      const html = buildContentSlideHtml({
        kicker: currentSectionTitle,
        pageLabel: `${pad2(slideNum)} / ${pad2(totalSlides)}`,
        footerLabel,
        blocksHtml,
        profile,
      });
      await shotPage.setContent(html, { waitUntil: "load" });
      await waitForImages(shotPage);
      file = path.join(outDir, `${pad2(slideNum)}-slide.png`);
      await shotPage.locator(".canvas").screenshot({ path: file, timeout: 20000 });
      files.push(file);
      process.stderr.write(`  slide ${slideNum} done\n`);
      slideNum++;
    }

    let fnPart = 0;
    for (const pageIdxs of footnotePages) {
      fnPart++;
      const label = footnotePages.length > 1 ? `Notes (${fnPart}/${footnotePages.length})` : "Notes";
      const blocksHtml = pageIdxs.map((i) => renderFootnoteItem(expandedFootnotes[i])).join("");
      const html = buildContentSlideHtml({
        kicker: label,
        pageLabel: `${pad2(slideNum)} / ${pad2(totalSlides)}`,
        footerLabel,
        blocksHtml,
        profile,
      });
      await shotPage.setContent(html, { waitUntil: "load" });
      file = path.join(outDir, `${pad2(slideNum)}-notes.png`);
      await shotPage.locator(".canvas").screenshot({ path: file, timeout: 20000 });
      files.push(file);
      process.stderr.write(`  slide ${slideNum} (notes) done\n`);
      slideNum++;
    }

    return {
      files,
      totalSlides,
      contentPagesCount: contentPages.length,
      footnotePagesCount: footnotePages.length,
      layoutLabel: describeProfile(profile),
      overBudget: totalSlides > maxSlides,
    };
  } finally {
    await browser.close();
  }
}

async function expandOversizedFootnotes(measurePage, footnotes, rawHeights, profile = DEFAULT_PROFILE) {
  const expanded = [];
  const contentWidth = CONTENT_WIDTH - 44; // fn-num column (30px) + gap (14px)
  for (let i = 0; i < footnotes.length; i++) {
    const f = footnotes[i];
    const h = rawHeights[i];
    if (h <= CONTENT_MAX_HEIGHT) {
      expanded.push(f);
      continue;
    }
    const fragments = await splitTextBlockToFit(
      measurePage,
      f.html,
      "fn-text",
      contentWidth,
      CONTENT_MAX_HEIGHT
    );
    process.stderr.write(
      `  split an oversized footnote #${f.number} into ${fragments.length} slide(s)\n`
    );
    fragments.forEach((html, idx) => expanded.push({ number: idx === 0 ? f.number : "", html }));
  }
  const heights = await measureFootnoteHeights(measurePage, expanded, profile);
  return { footnotes: expanded, heights };
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
