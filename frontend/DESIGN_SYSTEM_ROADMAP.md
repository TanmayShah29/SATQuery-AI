# SatQuery AI — Product Design & Branding Roadmap

> Working document. This is the single source of truth for the "make it feel like
> a shipped product, not a hackathon prototype" effort. Every session that touches
> UI/branding should read the **Progress Log** at the bottom before starting, and
> append to it before stopping.

---

## 1. The end vision

Today the app is functionally strong (real DAG-based audit trail, honest-failure
error handling, six purpose-built Studios) but visually reads as a generic dark
"tactical ops" template — because in places, literally, it was one (see the
`WorldMonitor` residue found and removed in Phase 0). The goal is not to change
what the product *does*. It's to make the first 10 seconds and the next 10 minutes
feel like a deliberately designed product from a team that knows exactly what
they're building, aimed at ISRO SAC evaluators who will judge polish as a proxy
for engineering rigor.

Concretely, "professional product" means:

1. **One brand, consistently applied.** A single mark, a single name lockup
   (`SatQuery AI` · `Divya Drishti` subordinate), one color system driving every
   surface — not per-component hex values chosen independently over months of
   iteration.
2. **A real front door.** A landing/briefing screen that sets context before
   dropping the user into a dense operational console — not the console itself
   as the entry point.
3. **Consistent interaction language across all 6 Studios.** Right now each
   Studio (`Bitemporal`, `Crossmodal`, `Grounding`, `Benchmark`, `Ingestion`,
   `Audit`) was built somewhat independently: panel chrome, spacing, badge
   styles, and status-color usage all drift slightly page to page. A shared
   layout shell + shared primitives (badges, panel headers, empty states) would
   make the whole app feel like one system instead of six sub-apps stitched
   together.
4. **Semantic color discipline.** Amber/cyan/emerald/red should mean something
   specific (warning/sensor/success/danger) everywhere, all the time — never
   decorative.

## 2. Brand identity decisions (locked in Phase 0)

- **Name lockup:** `SatQuery AI` (primary) · `Divya Drishti` (team name,
  subordinate) · `ISRO SAC · SIH26167` (provenance badge, smallest weight).
- **Mark:** orbital-sweep-over-aperture SVG (two concentric arcs + solid center
  dot) on a brand-gradient rounded square. Lives at:
  `frontend/public/favicon.svg`, inlined in `HeaderHUD.tsx` and `Landing.tsx`.
- **Brand hue:** Deep Space Indigo, `--sq-brand-500: #4C6FFF`. Reserved for
  brand marks, primary CTAs, and active-nav state only.
- **Semantic hues (status-only, never decorative):** `--sq-success` (emerald),
  `--sq-warning` (amber), `--sq-danger` (red), `--sq-sensor` (cyan — radar/SAR
  + telemetry accents specifically).
- **Neutral surface scale:** `--sq-bg-0` (app canvas) → `--sq-bg-3` (raised
  card/hover), `--sq-border-1/2`, `--sq-text-primary/secondary/muted`.
- **Type:** Plus Jakarta Sans (UI/prose), IBM Plex Mono (data/telemetry/labels)
  — unchanged, just now formalized as the rule rather than an accident of what
  was already loaded.
- All tokens live in `frontend/src/index.css` under `:root` — see that file's
  top comment block for the full list before adding a new color anywhere.

## 3. Phases

### Phase 0 — Brand foundation + Landing screen — **DONE**
- Design token layer added to `index.css`.
- Removed literal `WorldMonitor` template residue from `App.tsx` comments and
  `mapConfig.ts` style names.
- Rebuilt `HeaderHUD.tsx` brand mark + name lockup off the token system.
- Added `favicon.svg`, fixed `index.html` title/meta/OG tags to read as a
  product, not a problem-statement filename.
- Built `src/pages/Landing.tsx`: auto-rotating MapLibre globe (`globe`
  projection, reuses `createMapLibreStyle('dark','globe')` — no new deps),
  hero + 3 capability cards + trust strip + footer credit. "Launch Console"
  stops the rotation and `flyTo`s the globe into the dashboard's exact opening
  camera (`lat 23.03, lon 72.58, zoom 3.5, pitch 35`) before navigating to
  `/dashboard`, so the handoff reads as one continuous flight rather than a
  page cut. Wired into `main.tsx` via `react-router` (`/` → Landing,
  `/*` → App).
- **Known limitation, by design:** this is two MapLibre instances
  choreographed to land in the same place, not one instance handed off across
  the route change (that would require refactoring `MapCanvas.tsx` itself —
  too risky this close to judging). Worth revisiting post-SIH if a true
  single-instance transition is wanted.

### Phase 1 — Design token migration (in progress)
Goal: every component references `var(--sq-*)` tokens instead of one-off hex
values, so a future palette tweak is a one-file change, not a grep-and-pray.

Order of attack (safest/highest-leverage first):
1. `RightOperationalPanel.tsx`, `QueryPromptBar.tsx`, `LayersPanel.tsx` —
   shared chrome visible on every Studio.
2. `MapHeaderRibbon.tsx`, `TemporalScrubber.tsx`, `SearchModal.tsx`,
   `SituationalFeedDrawer.tsx`, `BenchmarkModal.tsx`, `GeoTIFFModal.tsx`,
   `ModelStatusModal.tsx` — secondary chrome/modals.
3. `MapCanvas.tsx` — touched last and most carefully; it's the most complex,
   most load-bearing file in the app (live map state, dual-instance bitemporal
   swipe, sensor-band filters). Cosmetic token swaps only, no logic changes.
4. `components/ui/StatusBadge.tsx`, `TelemetryGauge.tsx` — these are the
   primitives other components should eventually be refactored to use instead
   of hand-rolling badges inline; formalizing them is a Phase 3 task, not
   Phase 1.

### Phase 2 — Studio-by-studio consistency pass
Goal: one shared `StudioShell` layout (header pattern, panel spacing, empty
states) that `BitemporalStudio`, `CrossmodalStudio`, `GroundingStudio`,
`BenchmarkStudio`, `IngestionStudio`, and `AuditStudio` all sit inside, so
switching Studios feels like navigating one product instead of six.
Going one Studio at a time, in this order (simplest → most complex, so the
shared shell gets validated early on a low-risk page):
1. `AuditStudio.tsx`
2. `GroundingStudio.tsx`
3. `IngestionStudio.tsx`
4. `BenchmarkStudio.tsx`
5. `CrossmodalStudio.tsx`
6. `BitemporalStudio.tsx` (most complex — swipe curtain, dual-map sync)

### Phase 3 — Primitives + polish pass (stretch, post-Phase 2)
Formalize `StatusBadge`/`TelemetryGauge` as the only way badges/gauges get
built; sweep for remaining inconsistent spacing/radius; mobile bottom-nav
polish.

---

## 4. Progress Log
*(most recent first — append here, don't rewrite history)*

- **2026-09-12** — Started Phase 1 by reading `RightOperationalPanel.tsx` in
  full (the densest shared-chrome file). Finding: the near-black surface
  colors across panels/modals aren't a small, clean set — they're dozens of
  hand-picked near-duplicate shades (`#0A0D15` vs `#0E121B` vs `#0E131E`
  vs `#111520`, etc.) chosen file-by-file over time. Mass find-and-replacing
  these onto the Phase 0 token scale, sight-unseen, risks visibly shifting
  panel contrast/hierarchy in a codebase I can't render or screenshot from
  here — and I'm not going to gamble with that 6 days before your rounds.
  **Pivot:** added a canonical hex→token mapping table to the top of
  `index.css` ("MIGRATION NOTE") documenting exactly which existing hex maps
  to which token. This is zero-risk (pure documentation, no component files
  touched) and means the *next* person (me, next session, or you) doing the
  actual per-file swap has a lookup table instead of having to eyeball it.
  **Recommendation for the real swap:** do it with `npm run dev` running so
  each file's diff can be visually checked before moving to the next —
  either you drive with me giving you the replacements file-by-file, or we
  do it together in a session where I can see rendered output (e.g. via a
  screenshot you share, or once a preview/browser tool is available here).
  Blind mechanical edits to `RightOperationalPanel.tsx`, `MapCanvas.tsx`, and
  the six Studio pages are exactly the kind of change that should be visually
  verified, not shipped on faith.
  Phase 0 remains fully done and safe (brand tokens, WorldMonitor residue
  removed, HeaderHUD rebrand, favicon/meta, Landing.tsx with rotating globe +
  flyTo handoff, routing wired in `main.tsx`). Phase 2 (Studio shell) is
  blocked on the same visual-verification constraint and should follow the
  same file-by-file, dev-server-checked approach.
