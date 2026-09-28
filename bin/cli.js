#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import fs from "node:fs/promises";
import { fetchArticle } from "../src/fetch.js";
import { parseArticle } from "../src/parse.js";
import { renderSlides } from "../src/render.js";

function slugifyForDir(slug) {
  return slug.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

const program = new Command();

program
  .name("substack-to-insta")
  .description("Turn a Substack article into a set of square Instagram-ready slides.")
  .argument("<url>", "URL of a Substack article (or a Note that links to one)")
  .option("-o, --output <dir>", "output directory (default: ./output/<article-slug>)")
  .option("-m, --max-slides <n>", "maximum number of slides, cover and notes included", "20")
  .action(async (url, opts) => {
    try {
      console.log("→ Fetching article…");
      const article = await fetchArticle(url);
      console.log(`  ${article.title}`);
      console.log(`  ${article.author} — ${article.canonicalUrl}`);

      console.log("→ Parsing content…");
      const parsed = parseArticle(article.bodyHtml);
      console.log(
        `  ${parsed.blocks.length} blocks, ${parsed.footnotes.length} footnotes`
      );

      const outDir =
        opts.output ||
        path.join(process.cwd(), "output", slugifyForDir(article.slug));

      console.log("→ Laying out and rendering slides (headless Chromium)…");
      const maxSlides = Number.parseInt(opts.maxSlides, 10) || 20;
      const result = await renderSlides(article, parsed, outDir, { maxSlides });

      console.log(
        `\n✓ ${result.files.length} slides generated → ${outDir}`
      );
      console.log(
        `  1 cover, ${result.contentPagesCount} content slide(s), ${result.footnotePagesCount} notes slide(s)`
      );
      console.log(`  layout: ${result.layoutLabel} (limit ${maxSlides} slides)`);
      if (result.overBudget) process.exitCode = 2;
    } catch (err) {
      console.error(`\n✗ ${err.message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
