"use client";

import { useMemo, useState } from "react";
import {
  InfoCard,
  LegalDocShell,
  Section,
  WarningCard,
} from "@/components/policy/legal-doc";

const SECTIONS = [
  "1. What Is the Advanced Editor",
  "2. A Short Introduction to HTML and CSS",
  "3. What the Advanced Editor Gives You",
  "4. What You Can Create",
  "5. Editor Capabilities",
  "6. How Sanitization Works",
  "7. Allowed HTML Tags",
  "8. Allowed HTML Attributes",
  "9. Allowed CSS Properties",
  "10. Blocked CSS Values and Patterns",
  "11. Rules and Limitations",
  "12. Why These Rules Exist",
  "13. A Starter Template",
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => code.split("\n"), [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden my-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-overlay/5">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">
          copy and paste starter template
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-xs px-2 py-1 rounded border border-border text-muted hover:text-foreground hover:bg-overlay/10 cursor-pointer transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-foreground">
        <code>{lines.map((line, i) => (
          <span key={i} className="block">
            {line === "" ? "\u00A0" : line}
          </span>
        ))}</code>
      </pre>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 my-3">
      {tags.map((tag) => (
        <code
          key={tag}
          className="text-xs px-2 py-1 rounded bg-overlay/5 border border-border/50 text-foreground font-mono"
        >
          {tag}
        </code>
      ))}
    </div>
  );
}

function CssPropertyTable({ title, props }: { title: string; props: string[] }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {props.map((p) => (
          <code
            key={p}
            className="text-xs px-2 py-1 rounded bg-overlay/5 border border-border/50 text-foreground font-mono"
          >
            {p}
          </code>
        ))}
      </div>
    </div>
  );
}

const TEMPLATE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to My Diary</title>
    <style>
      :root {
        --ink: #2f2a25;
        --paper: #fbf7ef;
        --accent: #b4653a;
        --soft: #e8dcc8;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background: var(--paper);
        line-height: 1.7;
      }
      .page {
        max-width: 640px;
        margin: 0 auto;
        padding: 48px 24px;
      }
      header {
        text-align: center;
        border-bottom: 3px double var(--accent);
        padding-bottom: 20px;
        margin-bottom: 28px;
      }
      h1 {
        font-size: 2rem;
        letter-spacing: 0.5px;
        color: var(--accent);
        margin-bottom: 6px;
      }
      .tagline { font-style: italic; color: #7a6f62; }
      h2 {
        font-size: 1.2rem;
        color: var(--accent);
        margin: 28px 0 12px;
      }
      .intro { font-size: 1.05rem; }
      .card {
        background: var(--soft);
        border-radius: 10px;
        padding: 16px 18px;
        margin-top: 8px;
      }
      ul { padding-left: 22px; }
      li { margin: 4px 0; }
      .quote {
        font-style: italic;
        border-left: 4px solid var(--accent);
        padding: 4px 0 4px 16px;
        margin: 20px 0;
        color: #7a6f62;
      }
      footer {
        margin-top: 36px;
        padding-top: 14px;
        border-top: 1px solid var(--soft);
        text-align: center;
        font-size: 0.85rem;
        color: #7a6f62;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header>
        <h1>Hello, my name is Your Name!</h1>
        <p class="tagline">A little corner of the internet, all mine.</p>
      </header>

      <p class="intro">
        Welcome to my diary. I made this page with HTML and CSS in the
        Advanced Editor. It is simple, personal, and exactly how I like it.
      </p>

      <h2>About Me</h2>
      <div class="card">
        <ul>
          <li>I love writing and reading.</li>
          <li>I enjoy photography and long walks.</li>
          <li>I am learning to draw.</li>
          <li>I like quiet mornings and good coffee.</li>
        </ul>
      </div>

      <h2>My Hobbies</h2>
      <div class="card">
        <ul>
          <li>Keeping a daily journal.</li>
          <li>Exploring new music.</li>
          <li>Cooking family recipes.</li>
          <li>Watching the sky change color at sunset.</li>
        </ul>
      </div>

      <p class="quote">
        "The best time to start was yesterday. The next best time is now."
      </p>

      <footer>Made with love in the Advanced Editor.</footer>
    </main>
  </body>
</html>`;

export default function AdvancedEditorPage() {
  return (
    <LegalDocShell
      title="Advanced Editor"
      subtitle="A professional HTML and CSS editor for making your diary page truly yours."
      updated="August 20, 2026"
      sections={SECTIONS}
    >
      {/* ============================================================= */}
      {/* SECTION 1 */}
      {/* ============================================================= */}
      <Section title="1. What Is the Advanced Editor">
        <p className="text-base leading-relaxed text-muted mb-4">
          The Advanced Editor is a full-featured code editor built into
          DiaryArchive. It lets you write the raw HTML and CSS that shape how a
          single diary page looks. Instead of choosing from a fixed list of
          fonts and colors, you control every detail of the page, from the
          spacing between lines to the border of a quote.
        </p>
        <p className="text-base leading-relaxed text-muted mb-4">
          Your page is rendered inside an isolated sandbox. That means the code
          you write applies only to your diary and cannot interfere with the
          rest of the site or with other people&apos;s pages. You get the freedom
          of a code editor with the safety of a contained space.
        </p>
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted">
            The Advanced Editor is optional. Every diary works perfectly well
            with the visual editor, which handles formatting for you. Use the
            Advanced Editor when you want more control, or when you simply enjoy
            writing code.
          </p>
        </InfoCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 2 */}
      {/* ============================================================= */}
      <Section title="2. A Short Introduction to HTML and CSS">
        <p className="text-base leading-relaxed text-muted mb-4">
          Two simple languages power almost every page on the internet, and they
          power your diary page too.
        </p>
        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">HTML</h3>
          <p className="text-sm leading-relaxed text-muted">
            HTML, which stands for HyperText Markup Language, describes the
            <em>structure</em> of a page. It uses tags such as{" "}
            <code className="text-foreground">{"<h1>"}</code> for a heading,{" "}
            <code className="text-foreground">{"<p>"}</code> for a paragraph,
            and <code className="text-foreground">{"<img>"}</code> for an image.
            Think of HTML as the skeleton and the organs of the page.
          </p>
        </InfoCard>
        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">CSS</h3>
          <p className="text-sm leading-relaxed text-muted">
            CSS, which stands for Cascading Style Sheets, describes the
            <em>appearance</em> of a page. It sets colors, fonts, spacing, and
            layout. Where HTML decides what appears, CSS decides how it looks.
            Think of CSS as the skin, the clothing, and the styling.
          </p>
        </InfoCard>
        <p className="text-base leading-relaxed text-muted">
          You do not need to be an expert. Even a few tags can make a page feel
          personal. The starter template at the bottom of this page gives you a
          complete, working page you can edit line by line and learn as you go.
        </p>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 3 */}
      {/* ============================================================= */}
      <Section title="3. What the Advanced Editor Gives You">
        <InfoCard>
          <ul className="space-y-2.5 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              Write the full HTML of your diary page in a dedicated editor.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              Add a separate Custom CSS section for styling without touching the
              structure.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              See a live preview beside your code that updates as you type.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              Insert images from your media gallery, or paste and drop images
              directly into the code.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              Resize the dividers between your code and the preview, and between
              HTML and CSS, to test how the page reacts to different widths.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              Test responsiveness at mobile, tablet, and full widths.
            </li>
          </ul>
        </InfoCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 4 */}
      {/* ============================================================= */}
      <Section title="4. What You Can Create">
        <p className="text-base leading-relaxed text-muted mb-4">
          Almost any diary page you can imagine. Some common examples:
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">A Personal Introduction</h3>
            <p className="text-sm leading-relaxed text-muted">
              A welcome page that tells readers who you are, what you love, and
              what they can expect to read here.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">A Photo Journal</h3>
            <p className="text-sm leading-relaxed text-muted">
              A page that arranges your uploaded photos in a layout you design,
              with captions and colors of your choosing.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">A Quote Collection</h3>
            <p className="text-sm leading-relaxed text-muted">
              A gallery of the words that inspire you, each styled with its own
              border and tone.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">A Milestone Timeline</h3>
            <p className="text-sm leading-relaxed text-muted">
              A vertical list of important dates, events, and reflections from
              your life.
            </p>
          </InfoCard>
        </div>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 5 */}
      {/* ============================================================= */}
      <Section title="5. Editor Capabilities">
        <p className="text-base leading-relaxed text-muted mb-4">
          The Advanced Editor is a professional code editor, not a toy. It gives
          you the tools you expect from serious editing software.
        </p>
        <InfoCard>
          <ul className="space-y-2.5 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Syntax highlighting.</strong> HTML tags and CSS rules are color-coded so the structure is easy to read at a glance.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Line numbers and indentation.</strong> Keep your code tidy and aligned as it grows.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Automatic pair matching.</strong> Opening and closing tags and brackets are kept in sync as you type.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Find and replace.</strong> Locate and swap text across your code quickly.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Undo and redo.</strong> Step backward and forward through your edits.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Multiple selections and editing.</strong> Change several matching spots at once.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Copy, cut, and paste.</strong> Standard clipboard editing, including pasting images which upload and insert automatically.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Word wrap.</strong> Long lines stay readable without endless horizontal scrolling.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Light and dark themes.</strong> Choose a theme that is comfortable for your eyes.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Fullscreen mode.</strong> Focus on nothing but your code.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Live preview.</strong> See the result of your code the moment you type it.</span>
            </li>
          </ul>
        </InfoCard>
        <p className="text-sm leading-relaxed text-muted mt-2">
          Between the visual editor and the Advanced Editor, you can switch back
          and forth at any time. You are never locked into one way of working.
        </p>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 6: HOW SANITIZATION WORKS */}
      {/* ============================================================= */}
      <Section title="6. How Sanitization Works">
        <p className="text-base leading-relaxed text-muted mb-4">
          Every piece of HTML and CSS you write goes through a sanitization
          pipeline before it is stored and before any reader sees it. This
          happens automatically on both the frontend (in your browser) and the
          backend (on the server). The two layers use the same rules so that no
          harmful content ever reaches a reader.
        </p>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Frontend sanitization (in your browser)</h3>
          <p className="text-sm leading-relaxed text-muted mb-3">
            When you save a diary, the content is cleaned by DOMPurify before it
            leaves your browser. DOMPurify parses the HTML, removes any tags and
            attributes that are not on the allowed list, and scrubs inline style
            values against a blocklist of dangerous patterns. This is the first
            line of defense.
          </p>
          <h3 className="text-sm font-semibold text-foreground mb-2">Backend sanitization (on the server)</h3>
          <p className="text-sm leading-relaxed text-muted">
            When the server receives your diary content, it runs a second,
            independent sanitization pass using Bleach and tinycss2. This pass
            strips any remaining disallowed tags and attributes, parses every
            <code className="text-foreground">{"<style>"}</code> block and inline
            <code className="text-foreground">{"style=\"\""}</code> attribute, and
            removes CSS declarations that match dangerous value patterns. Even
            if someone bypassed the frontend, the backend would still catch
            everything.
          </p>
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">What the sanitizer does step by step</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">1.</span>
              <span>Extracts all <code className="text-foreground">{"<style>"}</code> blocks and inline <code className="text-foreground">{"style=\"\""}</code> attributes.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">2.</span>
              <span>Parses the CSS with tinycss2, then rebuilds each rule keeping only declarations with safe property names and safe values.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">3.</span>
              <span>Decodes CSS escape sequences (for example, <code className="text-foreground">{"\\72"}</code> becomes <code className="text-foreground">r</code>) to prevent obfuscation attacks.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">4.</span>
              <span>Checks every CSS value against a blocklist of dangerous patterns (such as <code className="text-foreground">url()</code>, <code className="text-foreground">javascript:</code>, <code className="text-foreground">data:</code>).</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">5.</span>
              <span>Strips any HTML tags not on the allowed list. Disallowed tags are removed but their text content is kept.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">6.</span>
              <span>Strips any HTML attributes not on the allowed list for each tag.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">7.</span>
              <span>Checks <code className="text-foreground">href</code> and <code className="text-foreground">src</code> values and blocks dangerous URI schemes such as <code className="text-foreground">javascript:</code>, <code className="text-foreground">data:</code>, and <code className="text-foreground">file:</code>.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">8.</span>
              <span>Drops <code className="text-foreground">@import</code>, <code className="text-foreground">@font-face</code>, and <code className="text-foreground">@charset</code> rules from CSS.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">9.</span>
              <span>Limits CSS nesting depth to 12 levels to prevent resource exhaustion.</span>
            </li>
          </ul>
        </InfoCard>

        <WarningCard>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            The sanitizer is applied every time you save. Changes you see in the
            live preview may differ from what is stored if your code contains
            disallowed elements. Always check the final rendered diary page
            after publishing.
          </p>
        </WarningCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 7: ALLOWED HTML TAGS */}
      {/* ============================================================= */}
      <Section title="7. Allowed HTML Tags">
        <p className="text-base leading-relaxed text-muted mb-4">
          Only the tags listed below are permitted. If you use a tag that is not
          on this list, it will be removed when you save. The text content inside
          a removed tag is kept, but the tag itself disappears.
        </p>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Text and inline</h3>
          <TagList tags={["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "strong", "em", "small", "sub", "sup", "mark", "abbr", "cite", "q", "s", "u", "code", "pre", "br"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Lists</h3>
          <TagList tags={["ul", "ol", "li", "dl", "dt", "dd"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Links and media</h3>
          <TagList tags={["a", "img", "hr"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Semantic layout</h3>
          <TagList tags={["div", "article", "section", "header", "footer", "aside", "nav", "main", "figure", "figcaption", "blockquote"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Tables</h3>
          <TagList tags={["table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Interactive (inert without JavaScript)</h3>
          <TagList tags={["details", "summary", "label", "input", "fieldset", "legend"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Style</h3>
          <TagList tags={["style"]} />
        </InfoCard>

        <WarningCard>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            The following tags are explicitly blocked and will always be removed:
            <code className="text-foreground">script</code>,{" "}
            <code className="text-foreground">iframe</code>,{" "}
            <code className="text-foreground">object</code>,{" "}
            <code className="text-foreground">embed</code>,{" "}
            <code className="text-foreground">form</code>,{" "}
            <code className="text-foreground">textarea</code>,{" "}
            <code className="text-foreground">select</code>,{" "}
            <code className="text-foreground">option</code>,{" "}
            <code className="text-foreground">button</code>,{" "}
            <code className="text-foreground">svg</code>,{" "}
            <code className="text-foreground">math</code>,{" "}
            <code className="text-foreground">link</code>,{" "}
            <code className="text-foreground">meta</code>,{" "}
            <code className="text-foreground">base</code>, and{" "}
            <code className="text-foreground">template</code>.
          </p>
        </WarningCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 8: ALLOWED HTML ATTRIBUTES */}
      {/* ============================================================= */}
      <Section title="8. Allowed HTML Attributes">
        <p className="text-base leading-relaxed text-muted mb-4">
          Attributes control the behavior and metadata of an HTML tag. Not all
          attributes are allowed. The following are the only ones permitted, and
          only on the tags where they make sense.
        </p>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Global attributes (allowed on all tags)</h3>
          <TagList tags={["class", "style", "title"]} />
          <p className="text-xs text-muted mt-2">
            The <code className="text-foreground">class</code> attribute lets you
            target elements with CSS. The <code className="text-foreground">style</code> attribute
            lets you apply inline CSS. The <code className="text-foreground">title</code> attribute
            adds a tooltip on hover.
          </p>
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Link attributes</h3>
          <p className="text-xs text-muted mb-2">
            On <code className="text-foreground">{"<a>"}</code> tags:
          </p>
          <TagList tags={["href", "target", "rel"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Image attributes</h3>
          <p className="text-xs text-muted mb-2">
            On <code className="text-foreground">{"<img>"}</code> tags:
          </p>
          <TagList tags={["src", "alt", "width", "height"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Form input attributes</h3>
          <p className="text-xs text-muted mb-2">
            On <code className="text-foreground">{"<input>"}</code> tags:
          </p>
          <TagList tags={["type", "checked", "disabled", "value", "name"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Label attributes</h3>
          <p className="text-xs text-muted mb-2">
            On <code className="text-foreground">{"<label>"}</code> tags:
          </p>
          <TagList tags={["for"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Table attributes</h3>
          <p className="text-xs text-muted mb-2">
            On <code className="text-foreground">{"<td>"}</code>,{" "}
            <code className="text-foreground">{"<th>"}</code>,{" "}
            <code className="text-foreground">{"<col>"}</code>, and{" "}
            <code className="text-foreground">{"<colgroup>"}</code> tags:
          </p>
          <TagList tags={["colspan", "rowspan", "scope", "align", "valign", "span"]} />
        </InfoCard>

        <WarningCard>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            All event handler attributes (such as{" "}
            <code className="text-foreground">onclick</code>,{" "}
            <code className="text-foreground">onerror</code>,{" "}
            <code className="text-foreground">onload</code>,{" "}
            <code className="text-foreground">onmouseover</code>) are always
            removed. The <code className="text-foreground">data-*</code> custom
            data attributes are also always removed. No exceptions.
          </p>
        </WarningCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 9: ALLOWED CSS PROPERTIES */}
      {/* ============================================================= */}
      <Section title="9. Allowed CSS Properties">
        <p className="text-base leading-relaxed text-muted mb-4">
          The sanitizer checks every CSS property name against an allowlist.
          Properties not on this list are silently dropped from both{" "}
          <code className="text-foreground">{"<style>"}</code> blocks and inline{" "}
          <code className="text-foreground">{"style=\"\""}</code> attributes.
        </p>

        <CssPropertyTable
          title="Typography"
          props={[
            "font-family", "font-size", "font-weight", "font-style",
            "color", "background-color", "background", "background-image",
            "text-align", "text-decoration", "text-indent", "text-transform",
            "line-height", "letter-spacing", "white-space", "word-wrap",
            "vertical-align", "text-shadow", "word-break", "overflow-wrap",
            "text-overflow",
          ]}
        />

        <CssPropertyTable
          title="Box model"
          props={[
            "margin", "margin-left", "margin-right", "margin-top", "margin-bottom",
            "padding", "padding-left", "padding-right", "padding-top", "padding-bottom",
            "border", "border-left", "border-right", "border-top", "border-bottom",
            "border-radius", "box-shadow", "border-collapse", "border-spacing",
          ]}
        />

        <CssPropertyTable
          title="Sizing and layout"
          props={[
            "width", "height", "min-width", "min-height", "max-width", "max-height",
            "display", "float", "overflow", "overflow-x", "overflow-y",
            "position", "top", "right", "bottom", "left", "inset", "z-index",
          ]}
        />

        <CssPropertyTable
          title="Flexbox"
          props={[
            "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
            "gap", "row-gap", "column-gap",
            "align-items", "align-self", "align-content",
            "justify-content", "justify-items", "justify-self",
            "place-items", "place-content", "place-self",
          ]}
        />

        <CssPropertyTable
          title="Grid"
          props={[
            "grid", "grid-template", "grid-template-columns", "grid-template-rows",
            "grid-template-areas", "grid-column", "grid-column-start", "grid-column-end",
            "grid-row", "grid-row-start", "grid-row-end", "grid-area",
            "grid-auto-flow", "grid-auto-rows", "grid-auto-columns", "grid-gap",
          ]}
        />

        <CssPropertyTable
          title="Visual and effects"
          props={[
            "box-sizing", "aspect-ratio", "object-fit", "object-position",
            "opacity", "transform", "transform-origin", "transition",
            "content", "filter", "backdrop-filter", "cursor",
            "user-select", "visibility",
          ]}
        />

        <CssPropertyTable
          title="Columns"
          props={["columns", "column-count", "column-gap"]}
        />

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Custom properties (CSS variables)</h3>
          <p className="text-sm leading-relaxed text-muted">
            Any CSS custom property whose name starts with{" "}
            <code className="text-foreground">--</code> is always allowed. You
            can define and use as many CSS variables as you like. This is the
            recommended way to keep your styles organized and easy to change.
          </p>
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">At-rules</h3>
          <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              <span><code className="text-foreground">@media</code> is allowed. Responsive breakpoints work as expected.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              <span><code className="text-foreground">@supports</code> is allowed. Feature queries work as expected.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
              <span><code className="text-foreground">@keyframes</code> (and vendor-prefixed variants) is allowed for CSS animations.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2717;</span>
              <span><code className="text-foreground">@import</code> is dropped. External stylesheets cannot be loaded.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2717;</span>
              <span><code className="text-foreground">@font-face</code> is dropped. Custom web fonts cannot be loaded.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2717;</span>
              <span><code className="text-foreground">@charset</code> is dropped.</span>
            </li>
          </ul>
        </InfoCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 10: BLOCKED CSS VALUES AND PATTERNS */}
      {/* ============================================================= */}
      <Section title="10. Blocked CSS Values and Patterns">
        <p className="text-base leading-relaxed text-muted mb-4">
          Even when a CSS property name is allowed, the value you assign to it
          is checked against a blocklist of dangerous patterns. If a value
          matches any of these patterns, the entire CSS declaration is removed.
          This prevents attacks that try to load external resources, execute
          code, or leak data through CSS.
        </p>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Blocked value patterns</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Pattern</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">What it catches</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Why it is blocked</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">url()</td>
                  <td className="px-3 py-2 text-muted">External resource loading (images, fonts, scripts)</td>
                  <td className="px-3 py-2 text-muted">Prevents loading external resources that could track readers or inject content</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">expression()</td>
                  <td className="px-3 py-2 text-muted">IE expression() function</td>
                  <td className="px-3 py-2 text-muted">Legacy IE XSS vector</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">@import</td>
                  <td className="px-3 py-2 text-muted">CSS @import statements</td>
                  <td className="px-3 py-2 text-muted">Prevents loading external stylesheets that could alter page appearance or leak data</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">javascript:</td>
                  <td className="px-3 py-2 text-muted">JavaScript URI scheme</td>
                  <td className="px-3 py-2 text-muted">Prevents code execution in the reader&apos;s browser</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">vbscript:</td>
                  <td className="px-3 py-2 text-muted">VBScript URI scheme</td>
                  <td className="px-3 py-2 text-muted">Legacy IE code execution vector</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">data:</td>
                  <td className="px-3 py-2 text-muted">data: URI scheme</td>
                  <td className="px-3 py-2 text-muted">Prevents embedding base64-encoded payloads, tracking beacons, or malicious content</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">-moz-binding</td>
                  <td className="px-3 py-2 text-muted">Mozilla XBL binding</td>
                  <td className="px-3 py-2 text-muted">Legacy Firefox XSS vector</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">behavior:</td>
                  <td className="px-3 py-2 text-muted">IE HTC behavior</td>
                  <td className="px-3 py-2 text-muted">Legacy IE code execution vector</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">progid:</td>
                  <td className="px-3 py-2 text-muted">IE ActiveX Transform</td>
                  <td className="px-3 py-2 text-muted">Legacy IE code execution vector</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">document.</td>
                  <td className="px-3 py-2 text-muted">DOM access</td>
                  <td className="px-3 py-2 text-muted">Prevents reading or modifying the page DOM from CSS</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">window.</td>
                  <td className="px-3 py-2 text-muted">Window object access</td>
                  <td className="px-3 py-2 text-muted">Prevents accessing browser APIs from CSS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Blocked URI schemes on links and images</h3>
          <p className="text-sm leading-relaxed text-muted mb-3">
            For <code className="text-foreground">href</code> and{" "}
            <code className="text-foreground">src</code> attributes, the
            following URI schemes are always blocked, regardless of context:
          </p>
          <TagList tags={["javascript:", "vbscript:", "data:", "file:", "about:"]} />
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Image source policy</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Source type</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Public diaries</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Private diaries</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-muted">Uploaded via media library</td>
                  <td className="px-3 py-2 text-muted">Allowed</td>
                  <td className="px-3 py-2 text-muted">Allowed (served with signed URL)</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 text-muted">Same-origin relative path</td>
                  <td className="px-3 py-2 text-muted">Allowed</td>
                  <td className="px-3 py-2 text-muted">Allowed</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-muted">External https: image</td>
                  <td className="px-3 py-2 text-muted">Allowed</td>
                  <td className="px-3 py-2 text-muted">Blocked</td>
                </tr>
                <tr className="border-b border-border/50 bg-overlay/5">
                  <td className="px-3 py-2 text-muted">External http: image</td>
                  <td className="px-3 py-2 text-muted">Blocked</td>
                  <td className="px-3 py-2 text-muted">Blocked</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-muted">javascript:, data:, vbscript:</td>
                  <td className="px-3 py-2 text-muted">Blocked</td>
                  <td className="px-3 py-2 text-muted">Blocked</td>
                </tr>
              </tbody>
            </table>
          </div>
        </InfoCard>

        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Escape sequence decoding</h3>
          <p className="text-sm leading-relaxed text-muted">
            Both sanitizers decode CSS escape sequences before checking against
            the blocklist. For example, <code className="text-foreground">{"\\72"}</code>{" "}
            becomes <code className="text-foreground">r</code>, and{" "}
            <code className="text-foreground">{"\\28"}</code> becomes{" "}
            <code className="text-foreground">(</code>. This prevents
            obfuscation attacks where someone writes{" "}
            <code className="text-foreground">{"j\\61vascript:"}</code> to bypass
            a simple string match. After decoding, angle brackets are re-encoded
            to prevent style-block breakout attacks.
          </p>
        </InfoCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 11: RULES AND LIMITATIONS */}
      {/* ============================================================= */}
      <Section title="11. Rules and Limitations">
        <p className="text-base leading-relaxed text-muted mb-4">
          To keep DiaryArchive safe and fast for everyone, the Advanced Editor
          enforces a few rules. They are intentionally simple.
        </p>
        <InfoCard>
          <ul className="space-y-2.5 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No scripts.</strong> JavaScript, embedded scripts, and event handlers such as <code className="text-foreground">onclick</code> are removed. Your page is made of HTML and CSS only.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No SVG images.</strong> The <code className="text-foreground">svg</code> tag is not on the allowed list. Use PNG, JPEG, WebP, or GIF images instead.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No buttons or forms.</strong> The <code className="text-foreground">button</code>, <code className="text-foreground">form</code>, <code className="text-foreground">textarea</code>, and <code className="text-foreground">select</code> tags are not allowed. Use <code className="text-foreground">{"<a>"}</code> links or styled <code className="text-foreground">{"<div>"}</code> elements instead.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No external fonts.</strong> The <code className="text-foreground">link</code> tag and <code className="text-foreground">@font-face</code> rule are dropped. Use system fonts such as Georgia, Arial, Verdana, or monospace.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No external images in private diaries.</strong> Private diaries block all images hosted on other websites. External <code className="text-foreground">https:</code> images are allowed only in public diaries.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Images must come from your media library.</strong> The safest way to include a picture is to upload it here, then insert it from your gallery.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No dangerous schemes.</strong> Links or image sources using <code className="text-foreground">javascript:</code>, <code className="text-foreground">data:</code>, <code className="text-foreground">file:</code>, or similar are removed.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">A safe set of HTML tags and CSS properties.</strong> Anything outside that set is stripped on save. See sections 7 through 10 for the complete lists.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">CSS nesting depth limit.</strong> CSS rules nested more than 12 levels deep are dropped to prevent resource exhaustion.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">A size limit.</strong> Very large pages are trimmed to keep every diary loading quickly.</span>
            </li>
          </ul>
        </InfoCard>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 12: WHY THESE RULES EXIST */}
      {/* ============================================================= */}
      <Section title="12. Why These Rules Exist">
        <p className="text-base leading-relaxed text-muted mb-4">
          These rules are not about limiting your creativity. They protect
          everyone who reads your diary, and everyone who shares the platform.
        </p>
        <InfoCard>
          <h3 className="text-sm font-semibold text-foreground mb-2">Security against attacks</h3>
          <p className="text-sm leading-relaxed text-muted mb-3">
            If arbitrary code were allowed in diary pages, a malicious page could
            try to steal cookies, redirect readers, or run unwanted programs in
            their browser. By restricting pages to sanitized HTML and CSS, your
            page is always safe to view. This is the single most important
            reason, and it is why the rules exist.
          </p>
          <h3 className="text-sm font-semibold text-foreground mb-2">Privacy for readers</h3>
          <p className="text-sm leading-relaxed text-muted mb-3">
            Loading an image from a third-party website can reveal a reader&apos;s
            IP address and browsing activity to that outside server. A private
            diary is meant to be read in confidence, so external images are
            blocked there entirely. Your own uploaded images are served from
            DiaryArchive and never leak a reader&apos;s details.
          </p>
          <h3 className="text-sm font-semibold text-foreground mb-2">Preventing data leaks through CSS</h3>
          <p className="text-sm leading-relaxed text-muted mb-3">
            CSS can be used to exfiltrate data. For example, a background image
            with a URL that includes a reader&apos;s information could send that
            data to an external server. The blocked value patterns (url(),
            data:, javascript:) prevent this kind of abuse while still allowing
            safe CSS features such as gradients, shadows, and transforms.
          </p>
          <h3 className="text-sm font-semibold text-foreground mb-2">Consistency and performance</h3>
          <p className="text-sm leading-relaxed text-muted mb-3">
            A size limit, a known set of allowed features, and a CSS nesting
            depth limit keep pages fast to load on any device and keep the site
            stable for everyone.
          </p>
          <h3 className="text-sm font-semibold text-foreground mb-2">Why SVG is blocked</h3>
          <p className="text-sm leading-relaxed text-muted">
            SVG files can contain embedded JavaScript, external references, and
            complex structures that are difficult to sanitize reliably. Rather
            than risk a gap in protection, the sanitizer removes all SVG content.
            Use raster image formats (PNG, JPEG, WebP, GIF) for your images
            instead.
          </p>
        </InfoCard>
        <p className="text-sm leading-relaxed text-muted mt-2">
          In short: anything that could harm a reader or the platform is removed,
          and everything that could only add beauty and personality is welcomed.
        </p>
      </Section>

      {/* ============================================================= */}
      {/* SECTION 13: STARTER TEMPLATE */}
      {/* ============================================================= */}
      <Section title="13. A Starter Template">
        <p className="text-base leading-relaxed text-muted mb-2">
          Here is a complete, ready-to-use page that introduces yourself, your
          hobbies, and a favorite thought. Copy it, paste it into the HTML editor
          of a new diary, and make it your own. Change the name, add your hobbies,
          and adjust the colors in the <code className="text-foreground">{"<style>"}</code>{" "}
          section to match your taste.
        </p>
        <CodeBlock code={TEMPLATE_HTML} />
        <WarningCard>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            To include a photo, upload it to your media library first, then insert
            it from the gallery button in the editor toolbar. That keeps your image
            private and reliable instead of relying on an outside host.
          </p>
        </WarningCard>
      </Section>
    </LegalDocShell>
  );
}
