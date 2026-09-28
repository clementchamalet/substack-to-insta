
export function renderBlock(block) {
  switch (block.type) {
    case "heading":
      return `<div class="blk heading level-${block.level || 3}">${escapeText(block.text)}</div>`;
    case "paragraph":
      return `<div class="blk paragraph">${block.html}</div>`;
    case "quote":
      return `<div class="blk quote">${block.html}</div>`;
    case "list": {
      if (block.html) return `<div class="blk list">${block.html}</div>`;
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items.map((h) => `<li>${h}</li>`).join("");
      return `<div class="blk list"><${tag}>${items}</${tag}></div>`;
    }
    case "figure": {
      const caption = block.caption
        ? `<div class="caption">${escapeText(block.caption)}</div>`
        : "";
      return `<div class="blk figure${block.closing ? " closing" : ""}"><img src="${block.src}" alt="">${caption}</div>`;
    }
    default:
      return "";
  }
}

export function renderFootnoteItem(fn) {
  return `<div class="fn-item"><span class="fn-num">${escapeText(
    fn.number
  )}</span><span>${fn.html}</span></div>`;
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
