/**
 * Splits a stored diary's content_html back into its leading <style> block
 * (the "custom CSS") and the remaining body HTML. The editor saves custom CSS
 * embedded at the start of content_html, so editing an HTML/CSS diary must
 * reverse that to keep the CSS in the Custom CSS field.
 */
export function splitHtmlCss(html: string): { css: string; html: string } {
  const m = /^\s*<style[^>]*>([\s\S]*?)<\/style>\s*/i.exec(html);
  if (!m) return { css: "", html };
  return { css: m[1], html: html.slice(m[0].length) };
}