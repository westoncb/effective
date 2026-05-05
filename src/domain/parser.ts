import type {
  AssignmentAst,
  ClipAst,
  CurveAst,
  CurveDef,
  Diagnostic,
  LaneAst,
  ParseResult,
  ProgramAst,
  SourceRange,
  TimeAst,
} from "./types";

type Token = {
  value: string;
  column: number;
  start: number;
  end: number;
};

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const TIME_RE = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/;

export function parseProgram(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const ast: ProgramAst = {
    masterAssignments: [],
    curves: [],
    lanes: [],
  };
  let currentLane: LaneAst | undefined;
  let offset = 0;

  const lines = source.replace(/\r\n/g, "\n").split("\n");

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const lineStart = offset;
    const commentStart = rawLine.indexOf("//");
    const line =
      commentStart >= 0 ? rawLine.slice(0, commentStart) : rawLine;
    const trimmed = line.trim();

    if (!trimmed) {
      offset += rawLine.length + 1;
      return;
    }

    const firstNonSpace = line.search(/\S/);

    if (trimmed.startsWith("dur ")) {
      const rawTime = trimmed.slice(4).trim();
      const column = firstNonSpace + 5;
      const range = rangeFor(lineStart, line, rawTime, column - 1);
      const parsed = parseTime(rawTime, lineNumber, column, range);
      if (parsed) {
        ast.duration = parsed;
      } else {
        diagnostics.push({
          message: `Invalid duration "${rawTime}". Use a number followed by ms or s.`,
          line: lineNumber,
          column,
          severity: "error",
          range,
        });
      }
      currentLane = undefined;
      offset += rawLine.length + 1;
      return;
    }

    if (trimmed.startsWith("master")) {
      const tokens = tokenizeInline(trimmed.slice("master".length), lineStart + firstNonSpace + "master".length);
      ast.masterAssignments.push(
        ...parseAssignments(tokens, lineNumber, diagnostics),
      );
      currentLane = undefined;
      offset += rawLine.length + 1;
      return;
    }

    if (trimmed.startsWith("curve ")) {
      const curve = parseCurveLine(trimmed, lineNumber, lineStart + firstNonSpace, diagnostics);
      if (curve) ast.curves.push(curve);
      currentLane = undefined;
      offset += rawLine.length + 1;
      return;
    }

    const laneMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*(.*)$/);
    if (laneMatch) {
      currentLane = {
        id: laneMatch[1],
        clips: [],
        line: lineNumber,
        column: firstNonSpace + 1,
      };
      ast.lanes.push(currentLane);
      const rest = laneMatch[2].trim();
      if (rest) {
        parseClipLine(rest, lineNumber, lineStart + rawLine.indexOf(rest), diagnostics).forEach((clip) =>
          currentLane?.clips.push(clip),
        );
      }
      offset += rawLine.length + 1;
      return;
    }

    if (trimmed.startsWith("[")) {
      if (!currentLane) {
        diagnostics.push({
          message: "Clip must appear under a lane header like `hit:`.",
          line: lineNumber,
          column: firstNonSpace + 1,
          severity: "error",
          range: { start: lineStart + firstNonSpace, end: lineStart + rawLine.length },
        });
      } else {
        parseClipLine(trimmed, lineNumber, lineStart + firstNonSpace, diagnostics).forEach((clip) =>
          currentLane?.clips.push(clip),
        );
      }
      offset += rawLine.length + 1;
      return;
    }

    diagnostics.push({
      message: "Unrecognized statement.",
      line: lineNumber,
      column: firstNonSpace + 1,
      severity: "error",
      range: { start: lineStart + firstNonSpace, end: lineStart + rawLine.length },
    });
    offset += rawLine.length + 1;
  });

  return { ast: diagnostics.some((d) => d.severity === "error") ? undefined : ast, diagnostics };
}

function parseClipLine(
  line: string,
  lineNumber: number,
  absoluteStart: number,
  diagnostics: Diagnostic[],
): ClipAst[] {
  const clips: ClipAst[] = [];
  const clipMatches = line.matchAll(/\[([^\]]*)\]/g);
  let found = false;

  for (const match of clipMatches) {
    found = true;
    const body = match[1].trim();
    const start = absoluteStart + (match.index ?? 0);
    const bodyStart = start + 1 + match[1].search(/\S/);
    const tokens = tokenizeInline(body, bodyStart);

    if (!tokens.length) {
      diagnostics.push({
        message: "Empty clip.",
        line: lineNumber,
        column: start - absoluteStart + 1,
        severity: "error",
        range: { start, end: start + match[0].length },
      });
      continue;
    }

    const header = tokens[0];
    const headerMatch = header.value.match(/^([A-Za-z_][A-Za-z0-9_.-]*)(?:#([A-Za-z_][A-Za-z0-9_.-]*))?$/);
    if (!headerMatch) {
      diagnostics.push({
        message: "Expected clip instrument name, optionally followed by #id.",
        line: lineNumber,
        column: header.column,
        severity: "error",
        range: { start: header.start, end: header.end },
      });
      continue;
    }

    const assignments: AssignmentAst[] = [];
    let clipStart: TimeAst | undefined;
    let duration: TimeAst | undefined;

    tokens.slice(1).forEach((token) => {
      if (token.value.startsWith("@")) {
        const raw = token.value.slice(1);
        const parsed = parseTime(raw, lineNumber, token.column + 1, {
          start: token.start + 1,
          end: token.end,
        });
        if (parsed) {
          clipStart = parsed;
        } else {
          diagnostics.push({
            message: `Invalid start time "${raw}".`,
            line: lineNumber,
            column: token.column,
            severity: "error",
            range: { start: token.start, end: token.end },
          });
        }
      } else if (token.value.startsWith("+")) {
        const raw = token.value.slice(1);
        const parsed = parseTime(raw, lineNumber, token.column + 1, {
          start: token.start + 1,
          end: token.end,
        });
        if (parsed) {
          duration = parsed;
        } else {
          diagnostics.push({
            message: `Invalid clip duration "${raw}".`,
            line: lineNumber,
            column: token.column,
            severity: "error",
            range: { start: token.start, end: token.end },
          });
        }
      } else if (token.value.includes("=")) {
        const [name, ...rest] = token.value.split("=");
        const value = rest.join("=");
        if (!name || !value) {
          diagnostics.push({
            message: "Assignment must be written as key=value.",
            line: lineNumber,
            column: token.column,
            severity: "error",
            range: { start: token.start, end: token.end },
          });
        } else {
          assignments.push({
            name,
            value,
            line: lineNumber,
            column: token.column,
            range: { start: token.start, end: token.end },
          });
        }
      } else {
        diagnostics.push({
          message: `Unexpected clip token "${token.value}".`,
          line: lineNumber,
          column: token.column,
          severity: "error",
          range: { start: token.start, end: token.end },
        });
      }
    });

    clips.push({
      instrument: headerMatch[1],
      id: headerMatch[2],
      start: clipStart,
      duration,
      assignments,
      line: lineNumber,
      column: header.column,
      range: { start, end: start + match[0].length },
    });
  }

  if (!found) {
    diagnostics.push({
      message: "Malformed clip. Wrap clip declarations in square brackets.",
      line: lineNumber,
      column: 1,
      severity: "error",
      range: { start: absoluteStart, end: absoluteStart + line.length },
    });
  }

  return clips;
}

function parseCurveLine(
  line: string,
  lineNumber: number,
  absoluteStart: number,
  diagnostics: Diagnostic[],
): CurveAst | undefined {
  const match = line.match(/^curve\s+([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(linear|exp|ease)(?:\s+(in|out|inout))?\s*$/);
  if (!match) {
    diagnostics.push({
      message: "Curve must be written as `curve name = linear|exp|ease [in|out|inout]`.",
      line: lineNumber,
      column: 1,
      severity: "error",
      range: { start: absoluteStart, end: absoluteStart + line.length },
    });
    return undefined;
  }

  const def: CurveDef = {
    type: match[2] as CurveDef["type"],
    shape: match[3] as CurveDef["shape"] | undefined,
  };

  return {
    name: match[1],
    def,
    line: lineNumber,
    column: line.indexOf(match[1]) + 1,
    range: { start: absoluteStart, end: absoluteStart + line.length },
  };
}

function parseAssignments(
  tokens: Token[],
  lineNumber: number,
  diagnostics: Diagnostic[],
): AssignmentAst[] {
  return tokens.flatMap((token) => {
    const [name, ...rest] = token.value.split("=");
    const value = rest.join("=");
    if (!name || !value) {
      diagnostics.push({
        message: "Assignment must be written as key=value.",
        line: lineNumber,
        column: token.column,
        severity: "error",
        range: { start: token.start, end: token.end },
      });
      return [];
    }

    return [
      {
        name,
        value,
        line: lineNumber,
        column: token.column,
        range: { start: token.start, end: token.end },
      },
    ];
  });
}

function parseTime(
  value: string,
  line: number,
  column: number,
  range: SourceRange,
): TimeAst | undefined {
  const match = value.match(TIME_RE);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  return {
    raw: value,
    ms: match[2] === "s" ? amount * 1000 : amount,
    line,
    column,
    range,
  };
}

function tokenizeInline(text: string, absoluteStart: number): Token[] {
  const tokens: Token[] = [];
  const matches = text.matchAll(/\S+/g);
  for (const match of matches) {
    const index = match.index ?? 0;
    tokens.push({
      value: match[0],
      column: index + 1,
      start: absoluteStart + index,
      end: absoluteStart + index + match[0].length,
    });
  }
  return tokens;
}

function rangeFor(
  lineStart: number,
  line: string,
  token: string,
  fallbackColumnZeroBased: number,
): SourceRange {
  const index = line.indexOf(token);
  const start = lineStart + (index >= 0 ? index : fallbackColumnZeroBased);
  return { start, end: start + token.length };
}

export function isIdentifier(value: string): boolean {
  return IDENT_RE.test(value);
}
