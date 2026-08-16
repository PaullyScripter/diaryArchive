/**
 * Shared Tailwind prose styling applied to rendered diary HTML (reader and
 * editor previews). Kept in one place so the reader, live preview, and preview
 * modal stay visually consistent.
 */
export const PROSE_CLASSES =
  "font-serif text-base leading-relaxed text-foreground " +
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 " +
  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-1 " +
  "[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-1 " +
  "[&_p]:my-2 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_pre]:bg-tag-bg [&_pre]:text-foreground [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-sm [&_pre]:overflow-x-auto " +
  "[&_code]:bg-tag-bg [&_code]:text-foreground [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono";