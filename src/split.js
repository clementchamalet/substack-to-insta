
export async function splitTextBlockToFit(measurePage, html, blockClass, contentWidth, maxHeight) {
  return measurePage.evaluate(
    ({ html, blockClass, contentWidth, maxHeight }) => {
      const rawTokens = html.match(/<[^>]+>|[^<]+/g) || [];
      const tokens = [];
      for (const t of rawTokens) {
        if (t.startsWith("<")) {
          tokens.push({ tag: true, value: t });
        } else {
          const words = t.match(/\s*\S+\s*|\s+/g) || [];
          for (const w of words) tokens.push({ tag: false, value: w });
        }
      }

      const isClosing = (tag) => /^<\//.test(tag);
      const isVoid = (tag) => /\/>\s*$/.test(tag);
      const tagName = (tag) => {
        const m = tag.match(/^<\/?\s*([a-zA-Z0-9]+)/);
        return m ? m[1].toLowerCase() : "";
      };

      function openStackAt(n) {
        const stack = [];
        for (let i = 0; i < n; i++) {
          const tok = tokens[i];
          if (tok.tag && !isVoid(tok.value)) {
            if (isClosing(tok.value)) stack.pop();
            else stack.push(tok.value);
          }
        }
        return stack;
      }

      function buildRange(start, end) {
        const stack = openStackAt(start);
        let out = stack.join("");
        for (let i = start; i < end; i++) {
          const tok = tokens[i];
          if (tok.tag) {
            if (isVoid(tok.value)) out += tok.value;
            else if (isClosing(tok.value)) {
              stack.pop();
              out += tok.value;
            } else {
              stack.push(tok.value);
              out += tok.value;
            }
          } else {
            out += tok.value;
          }
        }
        for (let i = stack.length - 1; i >= 0; i--) out += `</${tagName(stack[i])}>`;
        return out;
      }

      function measure(htmlStr) {
        const div = document.createElement("div");
        div.className = blockClass;
        div.style.width = contentWidth + "px";
        div.style.position = "absolute";
        div.style.left = "-99999px";
        div.style.visibility = "hidden";
        div.innerHTML = htmlStr;
        document.body.appendChild(div);
        const h = div.getBoundingClientRect().height;
        document.body.removeChild(div);
        return h;
      }

      const fragments = [];
      let start = 0;
      while (start < tokens.length) {
        const full = buildRange(start, tokens.length);
        if (measure(full) <= maxHeight) {
          fragments.push(full.trim());
          break;
        }
        let lo = start + 1,
          hi = tokens.length,
          best = start + 1;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const h = measure(buildRange(start, mid));
          if (h <= maxHeight) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (best <= start) best = start + 1;
        fragments.push(buildRange(start, best).trim());
        start = best;
      }
      return fragments.filter(Boolean);
    },
    { html, blockClass, contentWidth, maxHeight }
  );
}

export async function splitListToFit(measurePage, block, contentWidth, maxHeight, itemGap = 12) {
  const tag = block.ordered ? "ol" : "ul";
  const itemHtml = (items) => `<${tag}>${items.map((h) => `<li>${h}</li>`).join("")}</${tag}>`;

  const heights = await measurePage.evaluate(
    ({ items, tag, contentWidth }) => {
      return items.map((h) => {
        const div = document.createElement("div");
        div.className = "blk list";
        div.style.width = contentWidth + "px";
        div.style.position = "absolute";
        div.style.left = "-99999px";
        div.style.visibility = "hidden";
        div.innerHTML = `<${tag}><li>${h}</li></${tag}>`;
        document.body.appendChild(div);
        const height = div.getBoundingClientRect().height;
        document.body.removeChild(div);
        return height;
      });
    },
    { items: block.items, tag, contentWidth }
  );

  const groups = [];
  let current = [];
  let currentH = 0;
  for (let i = 0; i < block.items.length; i++) {
    const h = heights[i];
    const addH = current.length ? h + itemGap : h;
    if (current.length === 0 || currentH + addH <= maxHeight) {
      current.push(block.items[i]);
      currentH += addH;
    } else {
      groups.push(current);
      current = [block.items[i]];
      currentH = h;
    }
  }
  if (current.length) groups.push(current);

  return groups.map((items) => itemHtml(items));
}
