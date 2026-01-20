# Boardroom Reveal.js Style Guide

This guide defines a **premium, business-template aesthetic**—clear story, clean visuals, strong information hierarchy, and restrained motion—modeled after the kinds of decks YouExec publishes.
It also standardizes **advanced Reveal.js capabilities** (Auto-Animate, Scroll View, plugins, PDF export, speaker notes, etc.) and how to use them for **crisp CSS + SVG animation**.

---

## 1) Design goals

### What “boardroom-like” means in practice

* **Executive clarity**: one idea per slide, prominent takeaway, supporting evidence secondary.
* **Template discipline**: consistent grids, reusable components, “framework” slides (matrices, ladders, flywheels, KPIs, tables).
* **Premium restraint**: neutral base palette, 1–2 accents, soft depth (subtle shadow), generous whitespace.
* **Motion = meaning**: animation is used to *sequence logic*, not decorate.

### Non-goals (anti-patterns)

* “Game UI” effects: heavy parallax, bounce easing, neon gradients, busy backgrounds.
* Over-fragmenting: revealing every bullet on click (fatiguing) vs. chunked, deliberate builds.
* Huge transition variety: keep transitions consistent and low-key.

---

## 2) Narrative structure for boardroom decks

### Standard deck spine (recommended)

1. **Cover** (what / who / when)
2. **Executive summary** (3–5 bullets + 1 “so what”)
3. **Agenda / approach**
4. **Situation** (current state + metrics)
5. **Insight** (what it means)
6. **Options** (2–4 paths, trade-offs)
7. **Recommendation** (one choice + why now)
8. **Plan** (timeline, owners, milestones)
9. **Risks & mitigations**
10. **Appendix** (deep dives, backup charts)

### Reveal.js mapping

* **Horizontal slides** = main storyline (boardroom flow).
* **Vertical slides** = “drill-down” detail per chapter (keeps leaders oriented).

---

## 3) Layout system

### Canvas & safe zones

* Design for **16:9** (1920×1080 mental model), but keep content within a safe inset.
* Recommended content bounds:

  * Left/right padding: ~6–8% of width
  * Top: ~8–10% (room for title)
  * Bottom: ~6–8% (room for source/footnotes)

### Grid

* Use a 12-column grid internally (even if you don’t literally implement it).
* Prefer 4/8/12 column compositions:

  * 4: text rail
  * 8: charts/visuals

### Spacing tokens (example)

* `--s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px;`

---

## 4) Typography

### Type principles

* **Modern sans**; no quirky display fonts.
* Clear hierarchy: Title > Takeaway > Section labels > Body > Footnote.
* Line lengths: 45–80 chars; avoid wide paragraphs.

### Recommended scale (for 1080p baseline)

* H1 (slide title): 44–56px
* H2 (takeaway / headline): 32–40px
* Body: 20–26px
* Labels / chips: 14–18px
* Footnotes: 14–16px

### Micro-typography

* Use **sentence case** for headlines.
* Replace bullet lists with:

  * short “label + value” rows
  * 2-column “claim / evidence”
* Use **thin dividers** instead of heavy borders.

---

## 5) Color, theme, and depth

Corporate decks commonly offers **light and dark** variants across the same template family.

### Palette rules

* Base neutrals: near-white / charcoal (dominant).
* 1 primary accent (links, highlights, key series in charts).
* 1 semantic set: success / warning / risk (muted, not neon).

### Contrast & accessibility

* Text contrast target: WCAG AA where possible.
* Don’t encode meaning with color alone—use labels, icons, or patterns.

### Depth

* Use **one** shadow recipe:

  * small blur, low opacity, no harsh drop shadows
* Rounded corners are fine, but keep radii consistent (e.g., 12px for cards, 999px for pills).

---

## 6) Slide archetypes (build these as reusable components)

These align with common “business framework” decks.

### A) Cover

* Big title, subtitle, presenter + org, date.
* Optional abstract visual (soft gradient orb / geometric linework SVG).

### B) Executive summary

* 3–5 bullets max.
* 1 bold “Recommendation” chip.
* Mini KPI row (2–4 numbers) in cards.

### C) Section divider

* Single statement + one supporting line.
* Use a restrained background treatment (subtle grid, gradient wash, or blurred shapes).

### D) KPI / metric cards

* Number, label, delta (with arrow), timeframe.
* Use aligned baselines so rows scan fast.

### E) Data slides (charts, tables)

* Title states insight, not chart name (“Churn stabilized after onboarding fix”).
* Table design:

  * Light row separators
  * Left-aligned text, right-aligned numbers
  * Use emphasis sparingly (bold one row, one column)

### F) Framework slides

* Matrices, 2×2, scorecards, funnels, timelines, swimlanes.
* Make the “current” item pop with accent; others stay muted.

### G) Options / trade-offs

* 3 columns: Option, Upside, Risk.
* Or radar-like score table with consistent scoring visuals.

### H) Plan

* Timeline with 3–5 phases.
* Owners and milestones visible without reading paragraphs.

### I) Appendix

* Denser, smaller type acceptable, but preserve the same grid.

---

## 7) Motion principles (CSS + SVG first)

### Motion rules for boardroom decks

* Animate **opacity + transform** only (fast, crisp).
* Use short durations: 180–320ms for micro-reveals; 400–700ms for slide-level morphs.
* Easing: cubic-bezier that feels “decisive” (avoid bouncy).
* Prefer **one** motion language across the deck.

### Reveal.js motion toolkit to lean on

* **Fragments** for stepwise reveals.
* **Auto-Animate** for “same element, new state” morphs.
* **Scroll View** for async reading while keeping animations.

---

## 8) Advanced Reveal.js patterns (high impact, low chaos)

### 8.1 Auto-Animate: “state transitions” instead of “effects”

Use it for:

* KPI number grows into a chart
* A highlighted quadrant changes as you discuss options
* A table row expands into a detail card

```html
<section data-auto-animate>
  <h2 class="takeaway">Operating margin improved</h2>
  <div class="kpi" data-id="kpi-margin">+3.2 pts</div>
</section>

<section data-auto-animate>
  <h2 class="takeaway">Operating margin improved</h2>
  <div class="kpi kpi--small" data-id="kpi-margin">+3.2 pts</div>
  <svg class="chart" data-id="chart-margin" viewBox="0 0 600 240">
    <!-- chart -->
  </svg>
</section>
```

Notes:

* Keep element identity stable using `data-id`.
* Don’t change *everything* between slides; change 1–3 focal elements.

### 8.2 Fragments: “executive pacing”

* Chunk reveals into meaningful beats (usually 2–4 beats/slide).
* Prefer revealing *sections* over individual bullet lines.

```html
<ul class="points">
  <li class="fragment">Demand recovered in Q3</li>
  <li class="fragment">Supply constraints eased</li>
  <li class="fragment">Pricing held with minimal discounting</li>
</ul>
```

Advanced fragment control:

* Use `data-fragment-index` to sync multiple elements (callout + highlight).

### 8.3 Speaker notes & presenter workflow

* Use speaker notes for verbatims, numbers, and “if asked” backup.
* Make sure your team can present with **Speaker View**.

```html
<aside class="notes">
  Say: "This is margin after logistics renegotiation."
  If asked: baseline excludes one-time credits.
</aside>
```

### 8.4 Plugins: keep a “boardroom default set”

Reveal.js ships common plugins (Markdown, highlight, notes) and supports more.
Your default should include:

* Notes (presenter mode)
* Highlight (code only if needed)
* Markdown (optional, depending on authoring workflow)

### 8.5 Scroll View + PDF export: design for “live + read”

* Scroll View turns the deck into a readable page while preserving animations.
* PDF export exists, but treat it as a *separate output mode* with print styles.

Practical rule:

* Your slides should still make sense as a static artifact. Animation should enhance, not replace meaning.

---

## 9) Theme implementation (tokens-first)

### 9.1 CSS variables as your single source of truth

Create a theme file like `theme-youexec.css` and expose tokens:

```css
:root {
  --bg: #0b0f14;
  --panel: rgba(255,255,255,0.06);
  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.68);
  --accent: #7aa7ff;

  --radius-card: 14px;
  --shadow-1: 0 10px 30px rgba(0,0,0,0.25);

  --s-2: 8px;
  --s-4: 16px;
  --s-6: 24px;
  --s-8: 32px;

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
}

.reveal {
  font-family: var(--font-sans);
  color: var(--text);
}

.slide-title { font-size: 52px; letter-spacing: -0.02em; }
.takeaway { font-size: 36px; color: var(--text); }
.muted { color: var(--muted); }
.card {
  background: var(--panel);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-1);
  padding: var(--s-6);
}
```

### 9.2 Light/dark themes via `data-state`

Switch tokens per section:

```html
<section data-state="theme-light">...</section>
<section data-state="theme-dark">...</section>
```

```css
.reveal.theme-light {
  --bg: #ffffff;
  --panel: rgba(10,20,30,0.04);
  --text: rgba(10,20,30,0.92);
  --muted: rgba(10,20,30,0.62);
}
```

Hook state → class (simple JS in your deck bootstrap):

```js
Reveal.on('statechanged', e => {
  document.querySelector('.reveal').classList.toggle('theme-light', Reveal.getState().includes('theme-light'));
});
```

(Use your preferred approach; the key is **tokens**, not scattered styles.)

---

## 10) Crisp animation recipes (CSS)

### 10.1 “Executive fade-up” (default fragment animation)

```css
.reveal .fragment {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 220ms ease, transform 220ms ease;
  will-change: opacity, transform;
}
.reveal .fragment.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### 10.2 “Focus ring” highlight for active item

```css
.focus {
  position: relative;
}
.focus::after {
  content: "";
  position: absolute;
  inset: -8px;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--accent), transparent 35%);
  opacity: 0;
  transform: scale(0.98);
  transition: opacity 180ms ease, transform 180ms ease;
}
.fragment.visible .focus::after {
  opacity: 1;
  transform: scale(1);
}
```

### 10.3 “Panel swap” for option comparisons

Use Auto-Animate for the structure, and CSS for subtle polish (shadow/intensity change).

---

## 11) SVG animation patterns (clean, data-friendly)

### 11.1 Stroke draw (perfect for lines, timelines, connectors)

```css
.svg-draw path {
  stroke-dasharray: var(--dash, 400);
  stroke-dashoffset: var(--dash, 400);
  transition: stroke-dashoffset 600ms ease;
}
.fragment.visible .svg-draw path {
  stroke-dashoffset: 0;
}
```

### 11.2 Bar growth (transform-origin)

```css
.bar {
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform 480ms ease;
}
.fragment.visible .bar {
  transform: scaleY(1);
}
```

### 11.3 Emphasis without noise

* Use opacity shifts and thin accent strokes.
* Avoid animated gradients unless it communicates something real.

---

## 12) Reveal.js configuration baseline (boardroom-ready)

Reveal.js is highly configurable; start from a stable baseline and deviate sparingly.

```js
Reveal.initialize({
  hash: true,
  controls: true,
  progress: true,
  center: false,
  width: 1280,
  height: 720,

  transition: 'fade',
  backgroundTransition: 'fade',

  pdfSeparateFragments: false,

  plugins: [ RevealNotes, RevealMarkdown, RevealHighlight ]
});
```

Boardroom recommendations:

* `center: false` (more document-like layouts)
* `transition: 'fade'` or `'none'` (keep it sober)
* Disable fragment separation in PDFs if you export often.

---

## 13) Performance & quality bar

### Performance checklist

* Keep SVGs lean (avoid huge filters; pre-simplify paths).
* Prefer `transform/opacity` animations.
* Avoid animating layout properties (`top/left/width/height`) where possible.
* Test in the environment that matters:

  * Presenter laptop
  * Conference room clicker
  * External display scaling

### “Template quality” checklist

* Consistent padding and alignment everywhere.
* Every slide has a clear takeaway.
* Visuals are reusable components, not one-offs.
* Light and dark themes both work (if you support both).

---

## 14) Recommended project structure

```
deck/
  index.html
  css/
    theme-youexec.css
    components.css
    print.css
  js/
    init.js
    state-theme.js
  assets/
    icons/
    logos/
    svg/
    images/
  slides/
    00-cover.html
    01-exec-summary.html
    ...
```

* Keep component classes stable (`.card`, `.kpi`, `.grid`, `.chip`, `.divider`)
* Keep slide content mostly semantic; let CSS drive appearance.

---

## 15) House style “do & don’t” (quick reference)

**Do**

* Use 2–4 beats per slide (fragments or auto-animate).
* Write titles as conclusions.
* Use cards for grouping; thin dividers for separation.
* Animate charts minimally (draw line, grow bars, fade labels).

**Don’t**

* Use more than 1–2 accent colors in a single slide.
* Reveal bullets one-by-one for long lists.
* Mix multiple transition styles.
* Add motion that doesn’t change understanding.

