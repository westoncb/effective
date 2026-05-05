export type TextEdit = {
  source: string;
  selectionStart: number;
  selectionEnd: number;
};

const NUMBER_RE = /-?(?:\d+\.?\d*|\.\d+)(?:ms|s)?/g;

export function nudgeNumberAt(
  source: string,
  cursor: number,
  direction: 1 | -1,
  multiplier: number,
): TextEdit | undefined {
  const token = findNumberToken(source, cursor);
  if (!token) return undefined;

  const match = token.text.match(/^(-?(?:\d+\.?\d*|\.\d+))(ms|s)?$/);
  if (!match) return undefined;

  const value = Number(match[1]);
  const unit = match[2] ?? "";
  const step = stepForToken(match[1], unit) * multiplier;
  const next = value + direction * step;
  const replacement = `${formatLike(next, match[1])}${unit}`;
  const updated = `${source.slice(0, token.start)}${replacement}${source.slice(token.end)}`;

  return {
    source: updated,
    selectionStart: token.start,
    selectionEnd: token.start + replacement.length,
  };
}

export function duplicateClipLine(source: string, cursor: number): TextEdit | undefined {
  const line = getLineAt(source, cursor);
  const text = source.slice(line.start, line.end);
  if (!text.includes("[") || !text.includes("]")) return undefined;

  const duplicated = bumpClipId(text);
  const insertion = `\n${duplicated}`;
  const insertionPoint = line.end;

  return {
    source: `${source.slice(0, insertionPoint)}${insertion}${source.slice(insertionPoint)}`,
    selectionStart: insertionPoint + 1,
    selectionEnd: insertionPoint + 1 + duplicated.length,
  };
}

export function toggleCommentForLine(source: string, cursor: number): TextEdit {
  const line = getLineAt(source, cursor);
  const text = source.slice(line.start, line.end);
  const firstNonSpace = text.search(/\S/);
  const insertAt = firstNonSpace < 0 ? line.start : line.start + firstNonSpace;

  if (text.slice(firstNonSpace).startsWith("//")) {
    const commentStart = insertAt;
    const removeEnd = source[commentStart + 2] === " " ? commentStart + 3 : commentStart + 2;
    return {
      source: `${source.slice(0, commentStart)}${source.slice(removeEnd)}`,
      selectionStart: Math.max(line.start, cursor - (removeEnd - commentStart)),
      selectionEnd: Math.max(line.start, cursor - (removeEnd - commentStart)),
    };
  }

  return {
    source: `${source.slice(0, insertAt)}// ${source.slice(insertAt)}`,
    selectionStart: cursor + 3,
    selectionEnd: cursor + 3,
  };
}

function findNumberToken(source: string, cursor: number) {
  for (const match of source.matchAll(NUMBER_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (cursor >= start && cursor <= end) {
      return { text: match[0], start, end };
    }
  }
  return undefined;
}

function stepForToken(numericText: string, unit: string) {
  if (unit === "ms") return 10;
  if (unit === "s") return 0.05;
  if (numericText.includes(".")) return 0.01;
  return 1;
}

function formatLike(value: number, previous: string) {
  const decimals = previous.includes(".") ? previous.split(".")[1]?.length ?? 0 : 0;
  if (decimals > 0) return value.toFixed(Math.min(decimals, 4)).replace(/^-0\.?0*$/, "0");
  return Math.round(value).toString();
}

function bumpClipId(line: string) {
  return line.replace(/#([A-Za-z_][A-Za-z0-9_.-]*)/, (_match, id: string) => `#${id}.copy`);
}

function getLineAt(source: string, cursor: number) {
  const start = source.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const nextNewline = source.indexOf("\n", cursor);
  const end = nextNewline >= 0 ? nextNewline : source.length;
  return { start, end };
}
