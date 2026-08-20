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
  "6. Rules and Limitations",
  "7. Why These Rules Exist",
  "8. A Starter Template",
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
      updated="August 19, 2026"
      sections={SECTIONS}
    >
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

      <Section title="6. Rules and Limitations">
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
              <span><strong className="text-foreground">No external images in private diaries.</strong> Private diaries block all images hosted on other websites. External <code className="text-foreground">https:</code> images are allowed only in public diaries.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">Images must come from your media library.</strong> The safest way to include a picture is to upload it here, then insert it from your gallery.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">No dangerous schemes.</strong> Links or image sources using <code className="text-foreground">javascript:</code>, <code className="text-foreground">data:</code>, or similar are removed.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">A safe set of HTML tags and CSS properties.</strong> Anything outside that set is stripped on save.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              <span><strong className="text-foreground">A size limit.</strong> Very large pages are trimmed to keep every diary loading quickly.</span>
            </li>
          </ul>
        </InfoCard>
      </Section>

      <Section title="7. Why These Rules Exist">
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
          <h3 className="text-sm font-semibold text-foreground mb-2">Consistency and performance</h3>
          <p className="text-sm leading-relaxed text-muted">
            A size limit and a known set of allowed features keep pages fast to
            load on any device and keep the site stable for everyone.
          </p>
        </InfoCard>
        <p className="text-sm leading-relaxed text-muted mt-2">
          In short: anything that could harm a reader or the platform is removed,
          and everything that could only add beauty and personality is welcomed.
        </p>
      </Section>

      <Section title="8. A Starter Template">
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