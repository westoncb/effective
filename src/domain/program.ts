import { normalizeProgram } from "./normalize";
import { parseProgram } from "./parser";
import type { Diagnostic, ProgramAst, Timeline } from "./types";

export type ProgramResult = {
  status: "valid" | "invalid";
  ast?: ProgramAst;
  timeline?: Timeline;
  diagnostics: Diagnostic[];
};

export function buildProgram(source: string): ProgramResult {
  const parsed = parseProgram(source);
  if (!parsed.ast) {
    return {
      status: "invalid",
      diagnostics: parsed.diagnostics,
    };
  }

  const timeline = normalizeProgram(parsed.ast);
  const diagnostics = [...parsed.diagnostics, ...timeline.diagnostics];
  const hasError = diagnostics.some((diagnostic) => diagnostic.severity === "error");

  return {
    status: hasError ? "invalid" : "valid",
    ast: parsed.ast,
    timeline: hasError ? undefined : timeline,
    diagnostics,
  };
}
