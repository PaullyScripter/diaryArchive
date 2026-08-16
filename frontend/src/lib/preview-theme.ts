import type { CSSProperties } from "react";

/**
 * CSS variables overriding the site theme on a preview wrapper so custom CSS
 * that uses `var(--color-*)` can be previewed as a reader in light or dark.
 */
const LIGHT_TOKENS: Record<string, string> = {
  "--color-background": "hsl(40 20% 96%)",
  "--color-foreground": "hsl(0 0% 13%)",
  "--color-muted": "hsl(40 5% 45%)",
  "--color-subtle": "hsl(40 5% 60%)",
  "--color-border": "hsl(40 10% 84%)",
  "--color-accent": "hsl(15 40% 54%)",
  "--color-accent-soft": "hsl(15 30% 92%)",
  "--color-tag-bg": "hsl(40 10% 90%)",
  "--color-overlay": "hsl(0 0% 0% / 0.08)",
};

const DARK_TOKENS: Record<string, string> = {
  "--color-background": "hsl(40 5% 12%)",
  "--color-foreground": "hsl(40 5% 82%)",
  "--color-muted": "hsl(40 5% 60%)",
  "--color-subtle": "hsl(40 5% 45%)",
  "--color-border": "hsl(40 5% 22%)",
  "--color-accent": "hsl(15 55% 72%)",
  "--color-accent-soft": "hsl(15 25% 26%)",
  "--color-tag-bg": "hsl(40 5% 20%)",
  "--color-overlay": "hsl(0 0% 100% / 0.08)",
};

export type PreviewTheme = "system" | "light" | "dark";

export function previewThemeStyle(
  theme: PreviewTheme
): CSSProperties | undefined {
  const tokens =
    theme === "dark" ? DARK_TOKENS : theme === "light" ? LIGHT_TOKENS : undefined;
  if (!tokens) return undefined;
  return {
    colorScheme: theme,
    ...(tokens as CSSProperties),
  };
}