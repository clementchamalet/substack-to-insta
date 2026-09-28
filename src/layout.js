
export const CANVAS = 1080;
export const PADDING_X = 88;
export const CONTENT_WIDTH = CANVAS - PADDING_X * 2; // 904
export const HEADER_H = 78;
export const FOOTER_H = 56;
export const CONTENT_GAP_TOP = 28; // gap between header rule and first block
export const CONTENT_GAP_BOTTOM = 28; // gap between last block and footer rule
export const BLOCK_GAP = 30; // vertical gap the pagination logic adds between consecutive blocks
export const FN_GAP = 20; // vertical gap between footnote items (must match paginate.js)

export const CONTENT_MAX_HEIGHT =
  CANVAS - HEADER_H - FOOTER_H - CONTENT_GAP_TOP - CONTENT_GAP_BOTTOM;

export function makeProfile(scale = 1, { headingBreak = true } = {}) {
  const smallScale = Math.max(scale, 0.85);
  return {
    scale,
    headingBreak,
    smallScale,
    blockGap: Math.round(BLOCK_GAP * scale),
    listGap: Math.round(12 * scale),
    fnGap: Math.round(FN_GAP * smallScale),
    minFill: Math.round(170 * scale),
  };
}

export const DEFAULT_PROFILE = makeProfile(1);

export const COLORS = {
  paper: "#EEEDE5",
  paperAlt: "#E6E4D9",
  ink: "#211C16",
  inkSoft: "#5B5347",
  accent: "#A5402D",
  accentSoft: "#C97A55",
  rule: "rgba(33,28,22,0.16)",
};

export const FONTS = {
  serif:
    "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

export function baseCss(profile = DEFAULT_PROFILE) {
  const s = profile.scale;
  const r = (n) => Math.round(n * s);
  const rs = (n) => Math.round(n * profile.smallScale);
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: ${COLORS.paper}; }
    body {
      width: ${CANVAS}px;
      color: ${COLORS.ink};
      font-family: ${FONTS.serif};
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .canvas {
      width: ${CANVAS}px;
      height: ${CANVAS}px;
      position: relative;
      overflow: hidden;
      background: ${COLORS.paper};
      display: flex;
      flex-direction: column;
    }
    .chrome-header {
      height: ${HEADER_H}px;
      padding: 0 ${PADDING_X}px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid ${COLORS.rule};
      flex-shrink: 0;
    }
    .kicker {
      font-family: ${FONTS.sans};
      font-size: 20px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${COLORS.inkSoft};
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 620px;
    }
    .page-index {
      font-family: ${FONTS.sans};
      font-size: 20px;
      letter-spacing: 0.06em;
      color: ${COLORS.accent};
      font-weight: 700;
      white-space: nowrap;
    }
    .chrome-footer {
      height: ${FOOTER_H}px;
      padding: 0 ${PADDING_X}px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1.5px solid ${COLORS.rule};
      flex-shrink: 0;
    }
    .footer-label {
      font-family: ${FONTS.sans};
      font-size: 16px;
      letter-spacing: 0.04em;
      color: ${COLORS.inkSoft};
    }
    .content {
      width: ${CONTENT_WIDTH}px;
      margin: ${CONTENT_GAP_TOP}px auto ${CONTENT_GAP_BOTTOM}px auto;
      flex: 1;
      overflow: hidden;
    }
    .blk { width: 100%; }
    .blk + .blk { margin-top: ${profile.blockGap}px; }

    .blk.heading {
      font-family: ${FONTS.serif};
      font-weight: 700;
      font-size: ${r(42)}px;
      line-height: 1.22;
      color: ${COLORS.ink};
      padding-bottom: 6px;
      border-bottom: 3px solid ${COLORS.accent};
      display: inline-block;
    }
    .blk.heading.level-5, .blk.heading.level-6 {
      font-size: ${r(31)}px;
      line-height: 1.3;
      padding-bottom: 2px;
      border-bottom: 0;
    }
    .blk.paragraph {
      font-size: ${r(32)}px;
      line-height: 1.5;
      color: ${COLORS.ink};
      font-weight: 400;
    }
    .blk.paragraph .fn-ref {
      font-family: ${FONTS.sans};
      font-size: ${r(19)}px;
      color: ${COLORS.accent};
      font-weight: 700;
      margin-left: 1px;
    }
    .blk.paragraph .inline-link, .blk.quote .inline-link {
      color: ${COLORS.accent};
      text-decoration: none;
      border-bottom: 1.5px solid ${COLORS.accentSoft};
    }
    .blk.paragraph em, .blk.quote em { font-style: italic; }
    .blk.paragraph strong, .blk.quote strong { font-weight: 700; }

    .blk.quote {
      font-size: ${r(34)}px;
      line-height: 1.48;
      font-style: italic;
      color: ${COLORS.ink};
      padding-left: 30px;
      border-left: 5px solid ${COLORS.accent};
    }

    .blk.list ul, .blk.list ol { padding-left: 44px; }
    .blk.list { font-size: ${r(32)}px; line-height: 1.5; color: ${COLORS.ink}; }
    .blk.list li + li { margin-top: ${profile.listGap}px; }
    .blk.list ul { list-style: disc; }
    .blk.list ul li::marker { color: ${COLORS.accent}; }

    .blk.figure { text-align: center; }
    .blk.figure img {
      max-width: 100%;
      max-height: ${Math.round(CONTENT_MAX_HEIGHT * 0.56 * s)}px;
      width: auto;
      height: auto;
      display: block;
      margin: 0 auto;
      border-radius: 6px;
      object-fit: contain;
    }
    .blk.figure.closing img {
      max-height: ${Math.round(CONTENT_MAX_HEIGHT * 0.53 * s)}px;
    }
    .blk.figure .caption {
      margin-top: 16px;
      font-family: ${FONTS.sans};
      font-size: ${rs(20)}px;
      font-style: italic;
      color: ${COLORS.inkSoft};
      line-height: 1.4;
    }

    .fn-item { display: flex; gap: 14px; font-size: ${rs(21)}px; line-height: 1.42; color: ${COLORS.ink}; }
    .fn-item + .fn-item { margin-top: ${profile.fnGap}px; }
    .fn-text { font-size: ${rs(21)}px; line-height: 1.42; color: ${COLORS.ink}; }
    .fn-text em { font-style: italic; }
    .fn-item .fn-num {
      font-family: ${FONTS.sans};
      font-weight: 700;
      color: ${COLORS.accent};
      min-width: 30px;
      flex-shrink: 0;
      text-align: right;
    }
    .fn-item em { font-style: italic; }
  `;
}

export function docShell(bodyInner, extraCss = "", profile = DEFAULT_PROFILE) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${baseCss(profile)}${extraCss}</style></head>
<body>${bodyInner}</body></html>`;
}
