export type TokenType =
  | "plain"
  | "comment"
  | "string"
  | "property"
  | "at-rule"
  | "color"
  | "number"
  | "punct";

export interface CssToken {
  type: TokenType;
  text: string;
}

// Named groups: 1 comment, 2 string, 3 property, 4 at-rule, 5 color, 6 number,
// 7 punctuation.
const CSS_TOKEN_RE =
  /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(-{0,2}[a-zA-Z][\w-]*(?=\s*:))|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?)|([{};:()])/g;

export function tokenizeCss(code: string): CssToken[] {
  const tokens: CssToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = CSS_TOKEN_RE.exec(code))) {
    if (m.index > last) tokens.push({ type: "plain", text: code.slice(last, m.index) });
    const type: TokenType = m[1]
      ? "comment"
      : m[2]
        ? "string"
        : m[3]
          ? "property"
          : m[4]
            ? "at-rule"
            : m[5]
              ? "color"
              : m[6]
                ? "number"
                : m[7]
                  ? "punct"
                  : "plain";
    tokens.push({ type, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ type: "plain", text: code.slice(last) });
  return tokens;
}

/**
 * Returns 0 if braces are balanced (ignoring comments and strings), or the
 * net imbalance otherwise.
 */
export function braceBalance(code: string): number {
  const tokens = tokenizeCss(code);
  let depth = 0;
  for (const t of tokens) {
    if (t.type === "comment" || t.type === "string") continue;
    if (t.type !== "punct") continue;
    if (t.text === "{") depth++;
    else if (t.text === "}") depth--;
  }
  return depth;
}