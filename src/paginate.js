import { CONTENT_MAX_HEIGHT, CONTENT_WIDTH, DEFAULT_PROFILE } from "./layout.js";
import { measureBlockHeights } from "./measure.js";
import { splitTextBlockToFit, splitListToFit } from "./split.js";

export async function paginateFlow(measurePage, blocks, initialHeights, opts = {}) {
  const maxHeight = opts.maxHeight ?? CONTENT_MAX_HEIGHT;
  const contentWidth = opts.contentWidth ?? CONTENT_WIDTH;
  const profile = opts.profile ?? DEFAULT_PROFILE;
  const BLOCK_GAP = profile.blockGap;
  const minFill = opts.minFill ?? profile.minFill; // skip slivers too small to be worth a split

  const pages = [];
  let current = [];
  let currentH = 0;
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    currentH = 0;
  };

  const queue = blocks.map((b, i) => ({ block: b, height: initialHeights[i] }));

  const measureOne = async (block) => (await measureBlockHeights(measurePage, [block], profile))[0];
  const splitClass = (type) => (type === "quote" ? "blk quote" : "blk paragraph");
  const blockPageHeight = async (items) => {
    if (!items.length) return 0;
    const hs = await measureBlockHeights(measurePage, items, profile);
    return hs.reduce((sum, h) => sum + h, 0) + Math.max(0, items.length - 1) * BLOCK_GAP;
  };

  for (let qi = 0; qi < queue.length; qi++) {
    const { block, height } = queue[qi];

    if (block.type === "divider") {
      flush();
      continue;
    }

    if (block.type === "heading") {
      const majorHeading = (block.level || 3) <= 4;
      if (profile.headingBreak && majorHeading) {
        const nextItem = queue[qi + 1];
        const nextIsText =
          nextItem && (nextItem.block.type === "paragraph" || nextItem.block.type === "quote");
        const onlyFigure = current.length === 1 && current[0].type === "figure";
        const roomAfterHeading = current.length
          ? maxHeight - (currentH + BLOCK_GAP + height + BLOCK_GAP)
          : 0;
        const canBalanceSection =
          current.length > 0 &&
          !onlyFigure &&
          currentH < maxHeight * 0.45 &&
          nextIsText &&
          roomAfterHeading >= minFill;

        if (canBalanceSection) {
          const fragments = await splitTextBlockToFit(
            measurePage,
            nextItem.block.html,
            splitClass(nextItem.block.type),
            contentWidth,
            roomAfterHeading
          );
          const head = { type: nextItem.block.type, html: fragments[0] };
          const restHtml = fragments.slice(1).join(" ").trim();
          const headHeight = await measureOne(head);
          current.push(block);
          currentH += BLOCK_GAP + height;
          current.push(head);
          currentH += BLOCK_GAP + headHeight;
          flush();
          if (restHtml) {
            const rest = { type: nextItem.block.type, html: restHtml };
            queue[qi + 1] = { block: rest, height: await measureOne(rest) };
          } else {
            queue.splice(qi + 1, 1);
          }
          continue;
        }

        if (current.length && !onlyFigure) flush();
        if (
          onlyFigure &&
          currentH + BLOCK_GAP + height <= maxHeight
        ) {
          current.push(block);
          currentH += BLOCK_GAP + height;
          continue;
        }
        if (current.length) flush();
        current.push(block);
        currentH = height;
        continue;
      }

      const nextItem = queue[qi + 1];
      const nextIsContent =
        nextItem && nextItem.block.type !== "divider" && nextItem.block.type !== "heading";
      const addH = current.length ? height + BLOCK_GAP : height;
      const nextH = nextIsContent ? nextItem.height + BLOCK_GAP : 0;
      const fitsAlone = currentH + addH <= maxHeight;
      const fitsWithNext = currentH + addH + nextH <= maxHeight;

      if (!fitsAlone || (current.length > 0 && nextIsContent && !fitsWithNext)) flush();
      current.push(block);
      currentH += current.length === 1 ? height : height + BLOCK_GAP;
      continue;
    }

    const addH = current.length ? height + BLOCK_GAP : height;
    if (currentH + addH <= maxHeight) {
      current.push(block);
      currentH += addH;
      continue;
    }

    if (block.type === "figure") {
      const terminalFigure = qi === queue.length - 1;
      if (terminalFigure && current.length) {
        let paired = false;
        for (let splitAt = current.length - 1; splitAt > 0; splitAt--) {
          const prefix = current.slice(0, splitAt);
          const suffix = current.slice(splitAt);
          const suffixH = await blockPageHeight(suffix);
          if (suffixH + BLOCK_GAP + height <= maxHeight) {
            pages.push(prefix);
            current = [...suffix, block];
            currentH = suffixH + BLOCK_GAP + height;
            paired = true;
            break;
          }
        }
        if (!paired) {
          const last = current[current.length - 1];
          const lastIsText = last.type === "paragraph" || last.type === "quote";
          const roomForTail = maxHeight - height - BLOCK_GAP;
          if (lastIsText && roomForTail >= minFill) {
            const fragments = await splitTextBlockToFit(
              measurePage,
              last.html,
              splitClass(last.type),
              contentWidth,
              roomForTail
            );
            if (fragments.length > 1) {
              const tail = {
                type: last.type,
                html: fragments[fragments.length - 1],
              };
              const headHtml = fragments.slice(0, -1).join(" ").trim();
              const prefix = current.slice(0, -1);
              if (headHtml) prefix.push({ type: last.type, html: headHtml });
              const tailH = await measureOne(tail);
              pages.push(prefix);
              current = [tail, block];
              currentH = tailH + BLOCK_GAP + height;
              paired = true;
            }
          }
        }
        if (paired) continue;
      }
      flush();
      current.push(block);
      currentH = height;
      continue;
    }

    if (block.type === "list") {
      flush();
      if (height <= maxHeight) {
        current.push(block);
        currentH = height;
        continue;
      }
      const fragments = await splitListToFit(
        measurePage,
        block,
        contentWidth,
        maxHeight,
        profile.listGap
      );
      const objs = fragments.map((html) => ({ type: "list", html }));
      const heightsArr = await measureBlockHeights(measurePage, objs, profile);
      queue.splice(qi + 1, 0, ...objs.map((o, k) => ({ block: o, height: heightsArr[k] })));
      continue;
    }

    const remaining = maxHeight - (current.length ? currentH + BLOCK_GAP : 0);
    const canFillCurrent = current.length > 0 && remaining >= minFill;

    if (!canFillCurrent) {
      flush();
      if (height <= maxHeight) {
        current.push(block);
        currentH = height;
        continue;
      }
      const fragments = await splitTextBlockToFit(
        measurePage,
        block.html,
        splitClass(block.type),
        contentWidth,
        maxHeight
      );
      const head = { type: block.type, html: fragments[0] };
      const restHtml = fragments.slice(1).join(" ").trim();
      current.push(head);
      currentH = await measureOne(head);
      if (restHtml) {
        const rest = { type: block.type, html: restHtml };
        queue.splice(qi + 1, 0, { block: rest, height: await measureOne(rest) });
      }
      continue;
    }

    const fragments = await splitTextBlockToFit(
      measurePage,
      block.html,
      splitClass(block.type),
      contentWidth,
      remaining
    );
    const head = { type: block.type, html: fragments[0] };
    const restHtml = fragments.slice(1).join(" ").trim();
    const headHeight = await measureOne(head);
    current.push(head);
    currentH += current.length === 1 ? headHeight : headHeight + BLOCK_GAP;
    flush();
    if (restHtml) {
      const rest = { type: block.type, html: restHtml };
      queue.splice(qi + 1, 0, { block: rest, height: await measureOne(rest) });
    }
  }

  flush();
  return pages;
}

export function paginateFootnotes(footnotes, heights, maxHeight = CONTENT_MAX_HEIGHT, fnGap = DEFAULT_PROFILE.fnGap) {
  const pages = [];
  let current = [];
  let currentH = 0;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    currentH = 0;
  };

  for (let i = 0; i < footnotes.length; i++) {
    const h = heights[i];
    const addH = current.length ? h + fnGap : h;
    if (currentH + addH <= maxHeight || current.length === 0) {
      current.push(i);
      currentH += addH;
    } else {
      flush();
      current.push(i);
      currentH = h;
    }
  }
  flush();
  return pages;
}
