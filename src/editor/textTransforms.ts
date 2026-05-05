export type TextEdit = {
  source: string;
  selectionStart: number;
  selectionEnd: number;
};

export type ClipFlag = "mute" | "solo";

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

export function toggleClipFlagAt(
  source: string,
  cursor: number,
  flag: ClipFlag,
): TextEdit | undefined {
  const line = getLineAt(source, cursor);
  const text = source.slice(line.start, line.end);
  if (!text.includes("[") || !text.includes("]")) return undefined;

  const enabled = !hasEnabledFlag(text, flag);
  return setClipFlagAt(source, cursor, flag, enabled);
}

export function setClipFlagAt(
  source: string,
  cursor: number,
  flag: ClipFlag,
  enabled: boolean,
): TextEdit | undefined {
  const line = getLineAt(source, cursor);
  const text = source.slice(line.start, line.end);
  if (!text.includes("[") || !text.includes("]")) return undefined;

  const nextText = setClipFlagInText(text, flag, enabled);
  const sourceRangeStart = line.start;
  const sourceRangeEnd = line.end;
  const sourceNext = `${source.slice(0, sourceRangeStart)}${nextText}${source.slice(sourceRangeEnd)}`;
  const selectionStart = sourceRangeStart + flagValueOffset(nextText, flag);

  return {
    source: sourceNext,
    selectionStart,
    selectionEnd: selectionStart + 1,
  };
}

export function setClipFlagForRanges(
  source: string,
  ranges: Array<{ start: number; end: number }>,
  flag: ClipFlag,
  enabled: boolean,
): TextEdit | undefined {
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let nextSource = source;
  let selectionStart = sorted[sorted.length - 1]?.start ?? 0;
  let changed = false;

  sorted.forEach((range) => {
    const edit = setClipFlagAt(nextSource, range.start, flag, enabled);
    if (!edit) return;
    nextSource = edit.source;
    selectionStart = edit.selectionStart;
    changed = true;
  });

  if (!changed) return undefined;

  return {
    source: nextSource,
    selectionStart,
    selectionEnd: selectionStart + 1,
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

function hasEnabledFlag(text: string, flag: ClipFlag) {
  const match = text.match(flagRegex(flag));
  if (!match) return false;
  return ["1", "true", "yes", "on"].includes(match[2]);
}

function setClipFlagInText(text: string, flag: ClipFlag, enabled: boolean) {
  const value = enabled ? "1" : "0";
  const regex = flagRegex(flag);
  if (regex.test(text)) {
    return text.replace(regex, (_match, prefix: string, _value: string) => `${prefix}${value}`);
  }

  const insertAt = text.lastIndexOf("]");
  if (insertAt < 0) return text;
  return `${text.slice(0, insertAt)} ${flag}=${value}${text.slice(insertAt)}`;
}

function flagRegex(flag: ClipFlag) {
  const names = flag === "mute" ? "(?:mute|muted)" : "solo";
  return new RegExp(`(\\s${names}=)(1|0|true|false|yes|no|on|off)(?=\\s|\\])`);
}

function flagValueOffset(text: string, flag: ClipFlag) {
  const match = text.match(flagRegex(flag));
  if (!match || match.index === undefined) return 0;
  return match.index + match[1].length;
}

function getLineAt(source: string, cursor: number) {
  const start = source.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const nextNewline = source.indexOf("\n", cursor);
  const end = nextNewline >= 0 ? nextNewline : source.length;
  return { start, end };
}
