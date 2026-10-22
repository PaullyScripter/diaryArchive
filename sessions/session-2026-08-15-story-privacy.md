# DiaryArchive — "The Little Box with the Big Brass Lock"

A storybook-style diary you can post on DiaryArchive. It tells, the way you'd tell a
five-year-old, what DiaryArchive is, why it never collects or sells your data, the
tools and locks it uses, and why — because everything is encrypted — you absolutely must
remember your username and password.

## How to post it

1. Create a new diary and open the editor.
2. Paste **PART 1 (CSS)** into the editor's **Custom CSS** panel. Do NOT wrap it in
   `<style>` — the editor adds that for you.
3. Switch to Source mode (`</>`) and replace the content with **PART 2 (HTML)**.
4. Save / publish, then open the diary from your list. The reader widens the page and
   adds scrollbars so the full-page story fits.

## Platform notes (read before you post)

- The design uses **only CSS properties the sanitizer allows** (gradients, `transform`,
  `transition`, `opacity`, `filter`, `@media`, `@keyframes`). No `url()`, no external
  fonts, no scripts — so nothing gets stripped and nothing "phishes" the reader.
- The **slideshow** is a genuinely scrollable strip — swipe or scroll sideways through
  the promise cards. It works everywhere.
- The **"open the flaps"** sections use `<details>`/`<summary>` — tap/click to unfold.
  That is real animation via allowed properties.
- The CSS also includes a modern **scroll-reveal** (`@keyframes` + `animation-timeline:
  view()`, used by current Chrome/Edge/Safari). When posted, the backend sanitizer keeps
  `@keyframes` but drops the `animation` rule, so on the live site the paragraphs simply
  show as-is (a graceful fallback — nothing breaks). It reveals-on-scroll in the editor
  preview and in browsers that keep it. You can safely leave it; it's just icing.

---

## PART 1 — CUSTOM CSS

```
<!-- COPY FROM HERE (CSS) -->
/* ------------------------------------------------------------------ */
/* "The Little Box with the Big Brass Lock"                            */
/* Storybook CSS. Palette: cream paper, ink navy, honey, terracotta,   */
/* sage. Only sanitizer-allowed properties, no url(), no @import.      */
/* ------------------------------------------------------------------ */

/* ---- base page ---- */
.story-page{
  max-width:760px; margin:24px auto; padding:56px 40px 72px;
  background:
    radial-gradient(circle at 15% 12%, rgba(255,214,102,.35) 0, rgba(255,214,102,0) 34%),
    radial-gradient(circle at 88% 8%, rgba(111,158,120,.28) 0, rgba(111,158,120,0) 30%),
    linear-gradient(165deg,#fdf9ef 0%,#fbf3e2 46%,#f6ead2 100%);
  border:1px solid #ead9b6; border-radius:22px;
  box-shadow:0 24px 60px rgba(84,62,30,.16);
  color:#3a2f24; font-family:Georgia,"Times New Roman",serif; font-size:18px; line-height:1.9;
}
.story-page h1,.story-page h2,.story-page h3{
  font-family:"Trebuchet MS","Gill Sans",Verdana,sans-serif; color:#24304a; line-height:1.2;
}
/* ---- cover ---- */
.story-cover{ text-align:center; padding:18px 0 8px; }
.story-eyebrow{
  display:inline-block; padding:6px 16px; border:1px solid #d9c59a; border-radius:999px;
  background:#fff8e6; color:#8a6f33; font-family:"Trebuchet MS",Verdana,sans-serif;
  font-size:13px; letter-spacing:.14em; text-transform:uppercase;
}
.story-cover h1{ font-size:40px; margin:18px 0 6px; text-shadow:0 1px 0 #fff; }
.story-cover .sub{ color:#7a6a4d; font-style:italic; font-size:19px; margin-top:0; }
/* a little sun */
.story-sun{
  width:74px; height:74px; margin:10px auto 2px; border-radius:50%;
  background:radial-gradient(circle at 34% 30%, #ffe9a8, #ffc94d 70%);
  box-shadow:0 6px 22px rgba(255,183,48,.55);
}
/* little hills under the sun */
.story-hills{ position:relative; height:34px; margin:0 auto; width:100%; }
.story-hills .h1,.story-hills .h2,.story-hills .h3{ position:absolute; bottom:0; border-radius:50% 50% 0 0; }
.story-hills .h1{ left:6%; width:38%; height:26px; background:#b9d4b2; }
.story-hills .h2{ right:4%; width:46%; height:32px; background:#a3c69c; }
.story-hills .h3{ left:38%; width:26%; height:18px; background:#c9e0c0; }
/* ---- section labels ---- */
.story-label{
  display:flex; align-items:center; gap:12px; margin:52px 0 6px;
  font-family:"Trebuchet MS",Verdana,sans-serif; font-size:14px; letter-spacing:.14em;
  text-transform:uppercase; color:#b3722c; font-weight:bold;
}
.story-label::before,.story-label::after{ content:""; height:2px; flex:1; background:linear-gradient(90deg,rgba(179,114,44,0),rgba(179,114,44,.5)); }
.story-label::after{ transform:scaleX(-1); }
/* ---- drop cap ---- */
.story-drop::first-letter{
  float:left; font-size:64px; line-height:.82; padding:6px 10px 0 0;
  color:#d9773a; font-family:Georgia,serif; font-weight:bold;
}
/* ---- scroll reveal (progressive enhancement) ---- */
@supports (animation-timeline: view()) {
  .reveal{ animation:rise 1s ease both; animation-timeline:view(); animation-range:cover 0% cover 42%; }
}
@keyframes rise{
  from{ opacity:0; transform:translateY(26px); }
  to{ opacity:1; transform:translateY(0); }
}
/* ---- the little box (the lock illustration) ---- */
.story-box{ display:flex; flex-direction:column; align-items:center; margin:34px 0 8px; }
.box-body{
  width:150px; height:104px; border-radius:10px;
  background:linear-gradient(160deg,#a9743f,#8a5c2e 70%);
  border:1px solid #6f4a24; box-shadow:inset 0 -12px 22px rgba(0,0,0,.18),0 12px 24px rgba(84,62,30,.3);
}
.box-lid{ width:164px; height:26px; margin-top:-14px; border-radius:8px 8px 4px 4px;
  background:linear-gradient(180deg,#b98048,#a06a37); border:1px solid #6f4a24; }
.box-lock{
  width:34px; height:30px; margin-top:-38px; border-radius:6px;
  background:linear-gradient(180deg,#ffd76e,#e9a92b); border:2px solid #8a6a1e;
  box-shadow:0 6px 12px rgba(0,0,0,.25); position:relative; z-index:2;
}
.box-lock::before{ content:""; position:absolute; top:-13px; left:6px; width:16px; height:16px;
  border:3px solid #e9a92b; border-bottom:none; border-radius:10px 10px 0 0; }
.box-whisper{ font-style:italic; color:#7a6a4d; margin-top:16px; font-size:16px; }
/* ---- promise reel (the slideshow) ---- */
.story-reel{
  display:flex; gap:16px; overflow-x:auto; padding:10px 4px 22px; margin:14px 0 4px;
  scrollbar-color:#d9c59a #f7eeda; scrollbar-width:thin;
}
.slide{
  flex:0 0 82%; min-width:250px; padding:26px 24px; border-radius:18px;
  background:#fffdf6; border:1px solid #ead9b6;
  box-shadow:0 8px 20px rgba(84,62,30,.08);
  transform:translateY(0); transition:transform .22s ease, box-shadow .22s ease;
}
.slide:hover{ transform:translateY(-6px) rotate(-.4deg); box-shadow:0 18px 34px rgba(84,62,30,.16); }
.slide .num{ font-family:"Trebuchet MS",Verdana,sans-serif; font-size:13px; letter-spacing:.12em;
  text-transform:uppercase; color:#b3722c; font-weight:bold; }
.slide h3{ margin:8px 0 8px; font-size:22px; }
.slide p{ margin:0; font-size:17px; color:#5a4b38; }
.slide.accent{ background:linear-gradient(150deg,#fff6dd,#ffe7b8); }
.slide.ink{ background:linear-gradient(150deg,#33405e,#24304a); color:#fdf9ef; border-color:#33405e; }
.slide.ink h3{ color:#ffd76e; }
.slide.ink p{ color:#e9e2d2; }
/* ---- flaps (details accordions) ---- */
.flaps{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0 6px; }
.flap{ border:1px solid #d9c59a; border-radius:14px; background:#fffaf0; overflow:hidden;
  transition:transform .2s ease, box-shadow .2s ease; }
.flap:hover{ transform:translateY(-3px); box-shadow:0 10px 22px rgba(84,62,30,.12); }
.flap summary{ cursor:pointer; list-style:none; padding:16px 18px; font-family:"Trebuchet MS",Verdana,sans-serif;
  font-weight:bold; color:#24304a; font-size:16px; }
.flap summary::-webkit-details-marker{ display:none; }
.flap summary::before{ content:"🔒 "; }
.flap[open] summary::before{ content:"🔓 "; }
.flap .body{ padding:0 18px 18px; font-size:16px; color:#5a4b38; }
/* ---- the big rule ---- */
.story-rule{
  margin:20px 0; padding:26px 28px; border-radius:18px; text-align:center;
  background:linear-gradient(150deg,#fdf3d3,#ffe7b8); border:2px solid #e3b34f;
}
.story-rule h3{ font-size:24px; margin:0 0 8px; }
.story-rule p{ margin:0; font-size:17px; color:#5a4b38; }
/* ---- the grown-up corner ---- */
.story-tech{ margin:14px 0; padding:0 2px; }
.story-tech li{ margin:8px 0; }
.story-tech b{ color:#8a5c2e; }
/* ---- sign-off ---- */
.story-end{ text-align:center; margin-top:56px; color:#6f5a3a; }
.story-end .heart{ font-size:26px; }
.story-end p{ margin:4px 0; }
.story-sign{ margin-top:14px; font-family:Georgia,serif; font-style:italic; font-size:20px; color:#24304a; }

/* ---- responsive ---- */
@media (max-width:520px){
  .story-page{ padding:36px 22px 56px; font-size:17px; }
  .story-cover h1{ font-size:31px; }
  .flaps{ grid-template-columns:1fr; }
  .slide{ flex-basis:86%; }
}

/* COPY TO HERE (CSS) */
```

---

## PART 2 — HTML

```
<!-- COPY FROM HERE (HTML) -->
<div class="story-page">

  <!-- ============ COVER ============ -->
  <header class="story-cover">
    <div class="story-sun"></div>
    <div class="story-hills">
      <div class="h1"></div><div class="h2"></div><div class="h3"></div>
    </div>
    <span class="story-eyebrow">A bedtime story, told honestly</span>
    <h1>The Little Box with the Big Brass Lock</h1>
    <p class="sub">…or, what DiaryArchive really is, and why you must never forget your password.</p>
  </header>

  <!-- ============ CHAPTER ONE ============ -->
  <div class="story-label">Chapter One · The box</div>
  <p class="story-drop reveal">Shhh. Come sit with me on the rug. Pull your blanket up to your chin, and I will
    tell you about the little box that lives on the internet. Your very own little box. The people who made it
    call it <strong>DiaryArchive</strong>, but really it is just this: a wooden box, with a big brass lock, and
    your name painted on the lid.</p>
  <p class="reveal">Inside that box you can keep anything you like. What you ate for breakfast. The name of your
    best friend. A drawing of your cat. A secret you have not told anybody. Every day you can open the lid, drop
    a new page in, and shut it again. That is the whole trick of it — <em>your words, kept safe, for as long as
    you want them.</em></p>

  <!-- ============ CHAPTER TWO ============ -->
  <div class="story-label">Chapter Two · The promise</div>
  <p class="reveal">Now, here is the part some boxes get wrong. Some grown-ups' boxes watch you. They peek at
    your pages, count how many times you turn them, take little pictures of you, and then — do you know what? —
    they <strong>sell your drawings to strangers</strong> for coins. That is how a lot of the internet works. It
    makes me a little sad, honestly.</p>
  <p class="reveal">Our box is different. The people who made it made a promise, and they wrote it down:</p>
  <blockquote class="reveal" style="margin:22px 0; padding:16px 24px; border-left:4px solid #e3b34f; background:#fffaf0; border-radius:0 12px 12px 0; font-style:italic; color:#5a4b38;">
    We do not sell your words. We do not watch you. We do not peek at your pages. Your words are yours — like
    your favorite blanket. We are just the ones who hold the box.
  </blockquote>
  <p class="reveal">And because they do not peek, they do not even know what is inside. That is a stronger promise
    than "we will try not to look." That is the promise of a box with a real lock.</p>

  <!-- ============ THE LOCK ============ -->
  <div class="story-label">Chapter Three · The magic lock</div>
  <div class="story-box reveal">
    <div class="box-lid"></div>
    <div class="box-body"></div>
    <div class="box-lock"></div>
    <p class="box-whisper">Look — a little brass lock.</p>
  </div>
  <p class="reveal">Before anything goes inside the box, a helper folds your page into a secret code. Grown-ups
    call that <strong>encryption</strong>, but you can just call it <em>secret code</em>. Once your page is folded
    into code, it looks like gibberish — a jumble of letters and squiggles that means nothing to anyone who does
    not have the key.</p>
  <p class="reveal">And here is the wonderful part: <strong>only you have the key.</strong> Not the box-maker.
    Not the helpers. Not even the boss of the helpers. The moment your words go in, even the people who built the
    box cannot read them. They are yours, and yours alone, under the big brass lock.</p>

  <!-- ============ PROMISES SLIDESHOW ============ -->
  <div class="story-label">The Little Book of Promises</div>
  <p style="margin:2px 0 4px; font-style:italic; color:#7a6a4d;">Slide this sideways — touch it and pull, or use
    the little wheel on your mouse. Each card is one promise the box keeps.</p>
  <div class="story-reel">
    <div class="slide accent">
      <div class="num">Promise 1</div>
      <h3>We never sell your words.</h3>
      <p>Not for coins, not for shiny buttons, not ever. Your words are not merchandise.</p>
    </div>
    <div class="slide">
      <div class="num">Promise 2</div>
      <h3>We never collect your stuff.</h3>
      <p>We do not follow you around, watch which pages you read, or take little pictures of you.</p>
    </div>
    <div class="slide accent">
      <div class="num">Promise 3</div>
      <h3>Everything is locked.</h3>
      <p>Your pages are folded into secret code. We hold the box, not the key. We literally cannot peek.</p>
    </div>
    <div class="slide ink">
      <div class="num">Promise 4</div>
      <h3>No peepholes.</h3>
      <p>No sneaky trackers, no ads watching you, no little spies in the walls.</p>
    </div>
    <div class="slide">
      <div class="num">Promise 5</div>
      <h3>You are the only keeper.</h3>
      <p>Because only you have the key, only you can open it. That is why your name and password matter so much.</p>
    </div>
    <div class="slide accent">
      <div class="num">Promise 6</div>
      <h3>It is yours, always.</h3>
      <p>You can take your box and go whenever you like. Your words leave with you.</p>
    </div>
  </div>

  <!-- ============ THE TOOLS, TOLD SIMPLY ============ -->
  <div class="story-label">Chapter Four · The helpers and the locks</div>
  <p class="reveal">A box this safe needs helpers and locks. Let me show you the tools hiding in the walls, told
    the honest way:</p>
  <div class="flaps">
    <details class="flap">
      <summary>The secret tunnel</summary>
      <div class="body">When your page travels from your screen to the box, it rides through a <strong>secret
        tunnel</strong> (grown-ups call it TLS). Anyone standing on the side of the road sees only a swirl, not
        your words.</div>
    </details>
    <details class="flap">
      <summary>The secret code</summary>
      <div class="body">Your words are folded with <strong>AES-256-GCM</strong> — a code with so many possible
        keys that even a million strong computers, working together, could not guess it before the stars went
        out.</div>
    </details>
    <details class="flap">
      <summary>The name-checker</summary>
      <div class="body">To open the box you must say your name and password. The box does not keep your password
        written down; it keeps a <strong>smashed-up jumble</strong> of it (bcrypt), so even the box-maker could
        not read it back.</div>
    </details>
    <details class="flap">
      <summary>The bouncer and the shelves</summary>
      <div class="body">Behind the door, careful helpers keep everything tidy — <strong>MongoDB</strong> shelves
        your pages, <strong>Redis</strong> makes quick notes so the door opens fast, and <strong>Meilisearch</strong>
        helps you find the page you are looking for, without ever reading the secret parts.</div>
    </details>
    <details class="flap">
      <summary>Walls with no peepholes</summary>
      <div class="body">The box is built so nothing sneaks out and nothing sneaks in. No trackers, no ads, no
        scripts that peek. Privacy is the wallpaper.</div>
    </details>
    <details class="flap">
      <summary>Built open and checked</summary>
      <div class="body">The box's plans are written where people can read them, and every change is checked like a
        grown-up proofreading a story, so a mistake cannot sneak in quietly.</div>
    </details>
  </div>

  <!-- ============ THE BIG RULE ============ -->
  <div class="story-label">Chapter Five · The one rule you must never break</div>
  <div class="story-rule reveal">
    <h3>Never, ever forget your name and password.</h3>
    <p>Because only you have the key, <strong>nobody else can open your box — not even us.</strong> If you lose
      your name and password, there is no spare key hidden under the doormat, and no grown-up with a magic tool
      who can cut the lock. The box will stay shut, and its little pages will stay locked inside, safe and
      unreadable, forever.</p>
    <p style="margin-top:12px;">That is the price of a box that truly belongs to you. So pick a name you will
      remember, keep your password written in a safe secret place, and hold on to them like you hold on to your
      favorite blanket.</p>
  </div>

  <!-- ============ THE GROWN-UP CORNER ============ -->
  <div class="story-label">The Grown-Up Corner · the short honest list</div>
  <ul class="story-tech reveal">
    <li><b>What it is:</b> a private diary app — web (Next.js + React) and mobile — with a FastAPI backend.</li>
    <li><b>What it does not do:</b> no advertising, no data brokering, no tracking pixels, no selling or sharing
      of your data. There is nothing to harvest, because the content is encrypted before it leaves your device.</li>
    <li><b>Encryption:</b> end-to-end — diaries are encrypted client-side (AES-256-GCM) and your master key never
      leaves you; the server stores only ciphertext.</li>
    <li><b>In transit:</b> HTTPS / TLS 1.3 keeps every request in a tunnel.</li>
    <li><b>Storage &amp; services:</b> MongoDB (data), Redis (sessions/cache), Meilisearch (search index that
      never sees decrypted content), MinIO (object/media).</li>
    <li><b>Access:</b> passwords hashed with bcrypt, sessions over secure cookies; the master key is unlocked in
      memory only.</li>
    <li><b>Why you must remember credentials:</b> since the server cannot read your key, a lost password means
      the private diary is unrecoverable — by design, not by accident.</li>
  </ul>

  <!-- ============ GOODNIGHT ============ -->
  <div class="story-end">
    <div class="heart">★</div>
    <p>And so the little box sits on the shelf, its brass lock shining,</p>
    <p>holding your words close — yours, and only yours.</p>
    <p class="story-sign">Goodnight, my love. Sweet dreams, and keep your key safe.</p>
  </div>

</div>
<!-- COPY TO HERE (HTML) -->
```

---

## Quick sanity checklist

- Only allowlisted tags are used (`div`, `header`, `p`, `span`, `strong`, `em`,
  `blockquote`, `h1`–`h3`, `ol`/`li`, `details`/`summary`, `small`). No `button`, no `svg`, no scripts.
- Only allowlisted CSS is used; no `url()`, no `@import`, no external fonts, no `javascript:`.
- The slideshow needs no JavaScript — it is a native horizontal scroll strip.
- The flaps use `<details>`/`<summary>`, which the sanitizer permits and the reader renders interactively.