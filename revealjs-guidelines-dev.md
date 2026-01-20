# Reveal.js Presentation Style Guide for Dev + Product Teams

*A clean, modern, “documentation-first” visual system with precise motion, strong hierarchy, and interactive technical content.*

---

## 1) Design goals (what “good” looks like)

### Core principles

* **Readable from the back of the room**: big type, generous spacing, minimal clutter.
* **Editorial hierarchy**: a single clear message per slide, with strong titles and consistent visual rhythm.
* **Tech-friendly**: code, diagrams, charts, and prototypes must feel first-class (not “pasted screenshots”).
* **Motion is purposeful**: every animation explains change (state, flow, diff) rather than decorating it.
* **Interactive when it helps**: prototypes and live demos are contained, stable, and resettable.

### Non-goals

* Overdesigned “marketing decks” (heavy gradients, noisy backgrounds, excessive transitions).
* Over-animated content (avoid perpetual motion and non-explanatory effects).

---

## 2) Baseline Reveal.js setup (behavior + defaults)

### Recommended initialization (high-signal defaults)

Use these defaults to create a calm, top-aligned, documentation-like feel while keeping features available:

```js
Reveal.initialize({
  hash: true,                 // shareable URLs per slide
  center: false,              // top-align content for “doc” feel
  slideNumber: 'c/t',         // current/total
  showSlideNumber: 'all',
  progress: true,
  controls: true,
  controlsTutorial: false,

  width: 1280,
  height: 720,
  margin: 0.06,
  minScale: 0.2,
  maxScale: 2.0,

  transition: 'fade',         // calm default (override per slide when needed)
  backgroundTransition: 'fade',

  viewDistance: 3,            // balanced preload window for media-heavy decks
  preloadIframes: false,      // explicitly control iframe loading

  plugins: [
    RevealMarkdown,
    RevealHighlight,
    RevealNotes,
    RevealSearch,
    RevealZoom,
    RevealMath
  ],
});
```

* Use `center: false` for consistent “title at top, content below” layouts.
* Use `width/height/margin/minScale/maxScale` to author at a predictable canvas size.
* Keep transitions calm globally; override only when it communicates something meaningful.
* Plug-ins are registered through the `plugins` array at init.

### Slide structure rules (authoring contract)

* Your DOM hierarchy must follow: `.reveal > .slides > section` (and nested sections create vertical stacks).
* **Horizontal slides** = main narrative.
* **Vertical slides** = optional detail / “drill-down” (only when it won’t confuse navigation).

---

## 3) Theme system (typography, spacing, color)

### Typography (recommended scales)

**Font pairing**

* Primary (UI sans): `Inter`, `Source Sans 3`, or `IBM Plex Sans`
* Code: `JetBrains Mono`, `IBM Plex Mono`, or `Source Code Pro`

**Type scale (on a 1280×720 canvas)**

* Title: 52–64px (1 line; 2 lines max)
* Section divider title: 72–96px
* Body: 28–34px
* Dense body / tables: 22–26px (avoid smaller)
* Code: 20–26px (prefer fewer lines; scroll only as last resort)

**Rules**

* Titles are **left aligned** by default.
* Body text is **short**: prefer 3–6 bullets max.
* Never use more than two font families in a deck.

### Spacing + layout rhythm

* Slide padding: **48–64px** (visual breathing room)
* Vertical rhythm: 16px baseline grid (align elements to it)
* Column gap: 40–56px (avoid cramped “two-column squeeze”)

### Color system (minimal, high contrast)

Use a restrained palette:

* Background: near-white or very dark (choose one mode per deck)
* Text: near-black or near-white (not pure black/white)
* Accent: 1 primary accent color + 1 semantic (success/warn) if needed

**Rules**

* Use accent color for: links, key callouts, current focus states, diagram highlights.
* Avoid multiple competing accents on the same slide.

### Reveal theme variables

Reveal themes expose key tokens via CSS custom properties; build your theme by overriding those first, then component styles.

---

## 4) Slide templates (standardize your deck)

### A. Title slide

**Must include**

* Talk title (short)
* Subtitle (what’s in it for the audience)
* Presenter + team + date (small)

**Motion**

* None (or a single subtle fade-in)

### B. Section divider (chapter marker)

Purpose: reset attention and signal a new topic.

* Huge title (single phrase)
* Optional 1-line “why this matters”
* No other content

### C. Narrative content slide (default workhorse)

Structure:

* Title
* One “lead” sentence (optional)
* 3–6 bullets or one visual

### D. Diagram slide (architecture / flow)

Structure:

* Title
* Diagram canvas (SVG-first)
* Optional legend and 1–2 callouts

### E. Code walkthrough slide

Structure:

* Title
* Code block (line highlights step-by-step)
* Optional output panel (terminal/log)

### F. Data slide (chart)

Structure:

* Title
* Chart
* One takeaway sentence (big)

### G. Interactive prototype slide (wireframe)

Structure:

* Title
* Prototype frame (embedded, sandboxed)
* Visible “Reset” affordance + fallback screenshot

### H. Summary slide

Structure:

* Title: “What we decided” / “Next steps”
* 3 bullets max
* Owners + dates (if applicable)

### I. Appendix (uncounted)

Appendix should not distort progress/slide numbers.

* Mark appendix slides as **uncounted** so progress remains accurate.

---

## 5) Components (visual language you reuse)

### 5.1 Titles

* Always present.
* Always action-oriented (“Reduce p95 latency by 30%”, not “Performance”).

### 5.2 Callouts (info / warning / decision)

Create consistent callout styles (rounded rect, subtle border, icon optional).

* Info: neutral border + light tint
* Warning: stronger tint, reserved use
* Decision: accent border + bold label (“Decision”)

**Rules**

* One callout per slide unless it’s a comparison.
* Callouts should not exceed 30% of slide height.

### 5.3 “Card” blocks (for product concepts)

Use cards for:

* Feature slices
* Tradeoff grids
* Roadmap items

Cards should:

* Use a consistent radius
* Use subtle shadows (or none, but consistent)
* Align to the grid

### 5.4 Code blocks (first-class visual)

Enable syntax highlight and use Reveal’s code features:

* Use `data-line-numbers` for line numbers and specific highlights.
* Use **step-by-step line highlights** with `|` to walk through changes.
* Offset line numbers for excerpts with `data-ln-start-from`.

Example pattern:

```html
<pre><code class="language-ts" data-line-numbers="1-3|5-9|12-14" data-ln-start-from="120">
type Flags = { darkMode: boolean; beta: boolean }

export function decide(flags: Flags) {
  if (flags.beta) return "new"
  return flags.darkMode ? "dark" : "light"
}
</code></pre>
```

**Styling rules**

* Don’t show more than ~25–30 lines.
* Prefer highlighting + stepping over shrinking font size.
* Use “diff” styling (add/remove) via custom CSS classes when presenting changes.

### 5.5 Diagrams (SVG-first)

**Do this**

* Use **inline SVG** for architecture diagrams to keep everything crisp.
* Use consistent stroke width (2–3px) and rounded joins.
* Use `vector-effect="non-scaling-stroke"` on strokes to keep consistent line widths during scaling.
* Text inside diagrams should use the deck’s font tokens.

**Don’t**

* Don’t screenshot diagrams unless you have a static fallback for a live demo.
* Don’t use tiny labels; if it doesn’t fit, split across slides.

### 5.6 Charts (SVG-first)

* Use SVG rendering for sharpness and animation control.
* Make the takeaway text as prominent as the chart.

**Rules**

* Always label axes clearly.
* Avoid legends if direct labels are possible.
* One insight per chart slide.

### 5.7 Media + prototypes

* Lazy-load heavy assets and iframes using `data-src`.
* Iframes only load when visible by default; use `data-preload` only when you truly need preloading.
* Use the built-in lightbox behavior for zoomable images/videos/links when appropriate.

---

## 6) Motion system (crisp CSS + SVG)

### Motion philosophy

* Motion communicates **state change**.
* Prefer **short, easing-driven** transitions.
* Use **transform + opacity** (avoid animating layout properties).

### Timing + easing (house defaults)

* Micro: 120–180ms
* Standard: 180–260ms
* Emphasis: 260–420ms (rare)

Recommended easing:

* Standard: `cubic-bezier(0.2, 0.8, 0.2, 1)`
* Snappy: `cubic-bezier(0.3, 1, 0.3, 1)`

### Respect reduced motion

Add a global guard:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal * { animation: none !important; transition: none !important; }
}
```

### 6.1 Fragments (stepwise reveals)

Use fragments for:

* Progressive disclosure of bullets
* “Before → after” in diagrams
* Sequential highlighting

Reveal supports nested fragments and multiple styles.

**Rules**

* Default fragment effect: subtle fade + slight translate (no bouncing).
* Never fragment more than ~7 steps on one slide (attention fatigue).
* For diagrams: prefer “highlight this node/edge” rather than adding many new shapes each step.

### 6.2 Auto-Animate (continuity across slides)

Use Auto-Animate to show transformations:

* Refactors (code structure change)
* Architecture evolution (adding a component)
* UI state transitions (wireframe states)

Mechanism: add `data-auto-animate` to adjacent slides; matching elements animate automatically.

**Rules**

* Keep layout stable; only change what you want viewers to notice.
* Use consistent element identity (e.g., stable `data-id` values) for precise matching.

### 6.3 Slide transitions

Global transition should be calm; override per slide only when the transition itself communicates meaning (e.g., “zoom into detail” on a deep dive). Reveal supports per-slide overrides via `data-transition`.

### 6.4 SVG animation recipes (preferred for diagrams/graphs)

**A. Draw-on path (edges, arrows, chart lines)**

```css
.draw path {
  stroke-dasharray: var(--dash, 400);
  stroke-dashoffset: var(--dash, 400);
  transition: stroke-dashoffset 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.reveal .present .draw.visible path,
.reveal .present .draw.is-on path {
  stroke-dashoffset: 0;
}
```

Trigger with fragments by applying `.fragment draw` to a group.

**B. Focus highlight (node emphasis)**

```css
.node {
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
              opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.node.is-dim { opacity: 0.25; }
.node.is-focus { transform: scale(1.03); }
```

Use fragment steps to toggle `is-dim/is-focus`.

**C. Morph-by-replace (simpler than complex path morphing)**
Instead of morphing paths, crossfade between two SVG groups:

* Group A fades out
* Group B fades in + slight translate

This stays crisp and robust.

---

## 7) Advanced Reveal.js features you should actively use

### 7.1 Scroll View (share-friendly reading mode)

Enable a scrollable mode for post-meeting consumption:

* Initialize with `view: "scroll"` (and optional `scrollProgress`).
* Or activate via URL query `view=scroll` without changing config.

Style expectation in scroll mode:

* No “centered-only” layouts that leave awkward empty space.
* Avoid slide designs that rely on full-screen timing-only reveals.

### 7.2 Speaker View (delivery + pacing)

* Ensure Notes plugin is enabled and teach presenters to use Speaker View (`S`).
* Notes should be **actionable**: what to say, what to skip, timing cues.

### 7.3 PDF export (distribution)

Define a “print pass” checklist:

* Verify dark/light background graphics print correctly.
* Use print mode (`?print-pdf`) and export with background graphics enabled.

### 7.4 Slide visibility (optional content without progress penalty)

* Use `data-visibility="uncounted"` for optional slides that shouldn’t affect progress/slide number.
* Use `data-visibility="hidden"` to remove slides entirely.

### 7.5 Slide numbers (clear navigation)

* Prefer `c/t` for product/engineering readouts (audience knows “how far”).
  Reveal supports formats like `h.v`, `h/v`, `c`, `c/t`.

### 7.6 Link previews + lightbox (stay in-flow)

* Use `data-preview-link` to open external pages in an iframe overlay (when embeddable).
* Use `data-preview-image` / `data-preview-video` for zoomable media overlays.

### 7.7 Media control + lazy loading (performance + stability)

* Use `data-src` for lazy loading images/video/audio/iframes.
* Control autoplay globally with `autoPlayMedia` and per-element with `data-autoplay`.

### 7.8 Global state + events (slide-driven UI changes)

Use `data-state="something"` to apply global CSS changes when a slide is active, and optionally listen for the state event in JS.

### 7.9 API methods + keyboard customization (pro workflows)

* Use API toggles for help/overview/pause in custom controls.
* Override keyboard bindings via the `keyboard` config for your team’s conventions.

### 7.10 Multiplex (audience follows on their device)

If you run workshops or large rooms, use multiplex so viewers can follow along in real time.

### 7.11 postMessage API (embed + control)

If you embed the deck or need external control (or controlling embedded frames), use the built-in postMessage API pattern.

---

## 8) Interactive wireframes (explorable, reliable, resettable)

### Embed strategy

**Preferred**: iframe containing a self-contained prototype app.

* The prototype must:

  * Load fast
  * Have deterministic state
  * Provide a **Reset** function (button + JS hook)
  * Provide a static fallback (screenshot) for failures

### Lifecycle contract (must implement)

When a slide becomes visible:

* Mount/start the prototype (or focus it)
  When slide hides:
* Pause timers/animations
* Reset state (or store state if explicitly desired)

Use Reveal slide events in your glue code (your plugin or deck JS).

### Isolation + security

* Use `sandbox` on iframes (tighten capabilities).
* Avoid cross-origin surprises: if the prototype is cross-origin, plan for limited control.

### Performance requirements

* Lazy-load prototypes with `data-src`.
* Use `data-preload` only when the demo must be instant on arrival.

---

## 9) Layout utilities you should standardize

Reveal includes layout helpers that match a clean, structured style:

* `r-stack` for layered visuals (great with fragments).
* `r-fit-text` for big, perfectly-sized headings.
* `r-stretch` for filling remaining vertical space with a visual.
* `r-frame` for subtle emphasis around an element.

**Rule**

* Prefer these helpers over one-off hacks; they keep the deck consistent.

---

## 10) Quality checklist (ship gate)

### Visual + narrative

* [ ] Every slide has a clear, action-oriented title
* [ ] One primary idea per slide
* [ ] No slide exceeds: 6 bullets, 2 diagrams, or 1 dense table
* [ ] Consistent spacing and alignment across the deck
* [ ] Appendix slides are uncounted (progress remains meaningful)

### Code

* [ ] Code blocks are readable without shrinking type
* [ ] Highlights step through the story (not random)
* [ ] No more than ~30 visible lines at once

### Diagrams + charts

* [ ] SVG-first, crisp at any scale
* [ ] Motion explains change (build, highlight, compare)
* [ ] Each chart has exactly one stated takeaway

### Interactivity

* [ ] Prototypes lazy-load and have a reset mechanism
* [ ] There’s a fallback screenshot for every live embed
* [ ] No background audio/video surprises

### Delivery

* [ ] Speaker notes exist for complex slides
* [ ] Deck works in fullscreen
* [ ] Print/PDF pass is verified
* [ ] Scroll view is usable for readers

---

## 11) A minimal “house theme” skeleton (CSS starting point)

```css
:root{
  --bg: #fcfcfd;
  --fg: #111827;
  --muted: #6b7280;
  --accent: #2563eb;
  --border: rgba(17,24,39,.12);
  --radius: 16px;
}

.reveal {
  color: var(--fg);
}

.reveal .slides {
  text-align: left;
}

.reveal h1, .reveal h2, .reveal h3 {
  letter-spacing: -0.02em;
  margin-bottom: 0.6em;
}

.reveal p, .reveal li {
  line-height: 1.25;
}

.reveal a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 2px solid color-mix(in srgb, var(--accent), transparent 70%);
}

.callout {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 22px;
  background: color-mix(in srgb, var(--bg), var(--accent) 3%);
}

.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 22px;
  background: var(--bg);
}

.reveal pre {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
}

.reveal .fragment.fade-up {
  transform: translateY(10px);
}
.reveal .fragment.visible.fade-up {
  transform: translateY(0);
}
```

---

## 12) additional considerations

* **Narrative architecture for dev + product audiences**

  * Every major section must answer both:

    * **Product**: what changes for users/business and how success will be measured.
    * **Engineering**: how it works, constraints, tradeoffs, risks, and operational impact.
  * Prefer a **Decision → Evidence → Plan** rhythm:

    * State the decision/claim clearly.
    * Show the evidence (data, diagram, code excerpt).
    * End with next steps (who/when/what changes).

* **Recommended macro flow (deck information architecture)**

  * Title + context (owner, date, version, one-line purpose)
  * Problem statement + success metrics
  * User journey + wireframes (static first, then interactive)
  * Architecture overview (big picture)
  * Key flows + failure modes
  * API/contracts + data model
  * Observability + rollout plan
  * Milestones + risks
  * Decisions + open questions + asks
  * Appendix deep dives (vertical stacks, uncounted)

* **Navigation discipline (horizontal vs. vertical)**

  * Horizontal slides = what you want everyone to remember.
  * Vertical stacks = details you want available for Q&A, edge cases, alternatives, benchmarks, or “how it works” depth.
  * If a vertical stack exists, the top (parent) slide must still stand alone as a complete summary.

* **House patterns to standardize (use repeatedly)**

  * **Statement + Proof (2-column)**
    Left: claim/decision + bullets. Right: diagram/chart/code excerpt.
  * **Hero Visual**
    One diagram or chart fills the slide; minimal legend; one takeaway sentence.
  * **Before / After**
    Two states of UI/architecture/API; use auto-animate or controlled crossfade; label what changed.
  * **Options Table (only when necessary)**
    Max 3 options; show criteria; highlight decision and why.

* **Density rules (strict, to maintain clarity)**

  * Titles: **3–8 words** (actionable, specific).
  * Bullets: **≤ 5 bullets**, **≤ 10 words** each (unless it’s a quote or definition).
  * One “hero” element per slide (diagram *or* code *or* chart). If you need more, split into a vertical stack.
  * Avoid paragraphs; convert to structure (bullets, callouts, simple tables).

* **Micro-typography and consistency**

  * Don’t use ALL CAPS except small tags (e.g., RFC, WIP).
  * Keep line length reasonable (avoid full-width paragraphs).
  * Use consistent bullet punctuation across the whole deck (either none or always).
  * Prefer concrete labels over vague ones (“p95 latency” over “performance”).

* **Code walkthroughs that stay product-readable**

  * Show only the “interesting slice” (roughly 15–40 lines).
  * Prefer interfaces/contracts in the main narrative; push deep internals into vertical drill-down slides.
  * Use progressive disclosure:

    * Slide 1: API shape / event schema
    * Slide 2: core logic / key algorithm
    * Slide 3 (vertical): edge cases + performance notes + failure behavior
  * Pair “Code → Diagram” frequently:

    * Left: signature/schema
    * Right: sequence diagram or lifecycle flow showing where it runs and what it affects

* **Diagram depth taxonomy (keeps architecture coherent)**

  * Establish a consistent drill-down order across the deck:

    * Context (actors + systems)
    * Containers/services (major components + datastores)
    * Components/modules (inside a service)
  * Use vertical stacks for deeper levels; never mix levels randomly on the same slide.

* **Charts and graph clarity (analysis-ready, not marketing)**

  * Always show axes + units.
  * Prefer direct labels over legends.
  * One chart per slide unless it’s a strict small-multiple comparison.
  * Animate only **one semantic change at a time**:

    * Reveal baseline → highlight delta → show target/threshold/projection.

* **Interactive wireframes and demos (embedded responsibly)**

  * Use a **Static → Live** progression:

    * Slide A: annotated screenshot (fast, reliable)
    * Slide B: live embed (iframe)
    * Slide C (vertical optional): edge cases and alternate states
  * Resilience requirements:

    * Provide a **Reset State** control in the prototype.
    * Provide a fallback (static image) and a “Plan B” path (e.g., open externally) without breaking the talk.
    * Assume embeds may be blocked or slow; design for graceful failure.
  * Keep embeds deterministic:

    * No random states, no long warmups, no autoplay surprises.

* **Orchestration rules for embedded content**

  * On slide enter: initialize/focus the demo, start only what you need.
  * On slide exit: pause timers/media, detach listeners, reset state (or explicitly preserve state if that’s part of the narrative).
  * If timing matters (e.g., after transitions), trigger demo actions only once the slide is fully presented.

* **Small component additions that improve “technical deck UX”**

  * **Pills/Tags**: WIP, RFC, DECISION, RISK (small, consistent styling).
  * **Metric blocks**: big number + label + context (e.g., “p95: 220ms → 150ms”).
  * **Keyboard hints**: `.kbd` styling for demo controls (“R to reset”, “D to toggle debug”).
  * **Legend**: muted, tiny, consistent placement (avoid per-slide reinvention).

* **Accessibility & reliability (non-negotiable)**

  * Don’t encode meaning with color alone (use labels, icons, or patterns).
  * Ensure sufficient contrast and visible focus states for anything interactive.
  * Avoid relying on live network during critical moments; ship assets locally when possible.
  * Provide fallback slides for any demo or embed.

* **Pre-ship QA checks (run every time)**

  * Design consistency:

    * Layout patterns repeat predictably; callout styles are consistent.
    * Diagrams share font/stroke/radius rules.
  * Narrative clarity:

    * Each section starts with “why this matters”.
    * Every technical detail has an explicit “so what”.
  * Performance:

    * No stutter when navigating quickly.
    * Heavy assets are lazy-loaded; embeds don’t block transitions.
  * Orchestration:

    * Demo start/stop/reset behavior works when revisiting slides.
    * No broken states after jumping via slide overview or URL hash.

* **Org “starter kit” files to standardize**

  * `theme.css` (tokens + components + motion kit)
  * `reveal-overrides.css` (small last-mile fixes)
  * `patterns/` (copy-paste slide templates: architecture, API contract, decision, demo)
  * `demo-hooks.js` (slide lifecycle handlers for iframes and interactive elements)
  * `assets/` (shared icons, diagram primitives, chart styles, and UI components)

