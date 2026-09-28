# substack-to-insta

Generate square PNG slides from a public Substack article.

## Requirements

- Node.js 18 or later
- Chromium for Playwright

## Install

```sh
npm install
npx playwright install chromium
npm install -g .
```

## Usage

```sh
substack-to-insta <article-url> [-o <directory>] [-m <max-slides>]
```

Accepts article URLs and Substack links that resolve to an article. Slides are written to `./output/<article-slug>` by default. The slide limit defaults to 20, including the cover and footnotes.
