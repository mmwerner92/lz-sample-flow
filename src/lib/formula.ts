// Lightweight formula evaluator for calculated method fields.
// Formulas reference other field descriptions wrapped in braces:
//   ({Acid number} + {Base number}) / 2
// Supported tokens: numbers, + - * / ( ) , whitespace, and Math.* (min, max, abs, sqrt, pow, log, exp, round).

export function extractVariables(formula: string): string[] {
  const out: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const name = m[1].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

const ALLOWED_FNS = ["min", "max", "abs", "sqrt", "pow", "log", "exp", "round", "floor", "ceil"];

export function evalFormula(formula: string, values: Record<string, number | null | undefined>): number | null {
  if (!formula || !formula.trim()) return null;
  // Substitute {var} with numeric values; bail if any are missing.
  let expr = formula;
  const vars = extractVariables(formula);
  for (const v of vars) {
    const val = values[v];
    if (val === undefined || val === null || Number.isNaN(Number(val))) return null;
    expr = expr.split(`{${v}}`).join(`(${Number(val)})`);
  }
  // Allow Math.fn calls
  for (const fn of ALLOWED_FNS) {
    expr = expr.replace(new RegExp(`(?<![A-Za-z_])${fn}\\s*\\(`, "g"), `Math.${fn}(`);
  }
  // Whitelist remaining characters
  const stripped = expr.replace(/Math\.[a-z]+/g, "");
  if (!/^[\d\s+\-*/().,eE]*$/.test(stripped)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expr});`);
    const result = fn();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
