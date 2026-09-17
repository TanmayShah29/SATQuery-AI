# SatQuery AI — What the Frontend Must Deliver
**A requirements-first UI/UX report derived directly from the official SIH26167 problem statement**

**Method note:** This report was written by reading only the problem statement (`selected-problem-statement-26167.md`) and the ISRO PS list, deliberately *before* reviewing the existing frontend code, so the UI requirements below are derived from what the jury will actually evaluate — not from what has already been built. Cross-check this against the current `frontend/` implementation as a gap analysis, not the other way around.

---

## 1. What the problem statement actually asks the UI to prove

Strip away the aesthetics and SIH26167 is graded on five hard requirements. Every screen, panel, and control in the frontend exists to make one of these five *visibly, undeniably true* to a judge in under 90 seconds:

| # | Mandatory requirement (from the PS) | What this means the UI must show |
|---|---|---|
| 1 | Remote-sensing adaptation (not a generic LLM/VLM) | The UI must never look like a chat wrapper. It must surface *which* specialist model ran, and that it was fine-tuned/adapted — not GPT-4V describing a photo. |
| 2 | Single-image baseline: VQA mandatory + (captioning OR grounding) | A single-image mode that visibly answers a typed question AND either narrates the scene or draws a box/mask around what was asked about. |
| 3 | Multi-image change analysis (bi-temporal) | A two-image mode with a way to see *both* images, a way to see *where* something changed, and a way to see *what* changed in words. |
| 4 | Cross-modal pair analysis (optical + SAR) | A way to load one optical and one SAR image of the same place and show that the system used both together (e.g. SAR revealing something optical/clouds hid). |
| 5 | Agentic orchestration, auditably | A visible, inspectable trace of: query → task classified → model(s) selected → parameters used → output. The PS explicitly states only the *observable execution trace* is evaluated, not internal reasoning text — so this trace is not a "nice to have," it is graded evidence. |

Everything below expands these five into concrete screens, components, and interaction patterns.

---

## 2. Who is actually using this, and what they need from the interface

The PS defines its own users implicitly: **non-expert domain users** who currently "may find it difficult to obtain meaningful information from satellite imagery... through simple natural-language queries," plus (at Grand Finale) an **ISRO/SAC jury** scoring rigor and auditability. Two audiences, two different reads of the same screen:

- **The domain user** (disaster manager, agri officer, urban planner) needs: minimal GIS jargon, a text box that "just works," clear plain-English answers, and visual proof they can trust (a highlighted box or map, not just prose).
- **The jury/evaluator** needs: proof of task classification, proof of model selection logic, input validation behavior, confidence scores, and exportable evidence — i.e., the *audit trail* layered on top of the same screen.

The frontend has to serve both simultaneously: a clean top layer for the query/answer loop, and a always-available inspection layer underneath for anyone who wants to verify what actually happened.

---

## 3. Information architecture — the five zones

Regardless of implementation framework, the interface decomposes into five functional zones. Every feature listed in the PS's "Component Architecture" (input validator, VL component, specialist tools, controller, evidence display) maps to exactly one zone, so there is no ambiguity about where a capability should live.

```
┌────────────────────────────────────────────────────────────────────┐
│  ZONE A — Status / Context Bar                                     │
│  (what's loaded, what format, what CRS/co-registration state)      │
├───────────────┬───────────────────────────────────┬────────────────┤
│  ZONE B       │  ZONE C — Image Canvas             │  ZONE D        │
│  Input &      │  (single / cross-modal / bi-       │  Answer &      │
│  Mode Rail    │   temporal viewing + evidence       │  Evidence Card │
│  (upload,     │   overlays)                         │                │
│  format check,│                                     │                │
│  AOI tools)   │                                     │                │
├───────────────┴───────────────────────────────────┴────────────────┤
│  ZONE E — Query Console + Agentic Execution Trace (collapsible)    │
└────────────────────────────────────────────────────────────────────┘
```

- **Zone A** exists only because the PS makes input validity a graded step (format, metadata, co-registration compatibility). If the UI hides this, the jury cannot see that validation happened.
- **Zone B** exists because the PS defines three distinct input configurations (single / cross-modal pair / bi-temporal pair) as first-class, not one generic "upload." The UI must force the user to *declare* which of the three they're doing, because that declaration is itself part of what the controller has to interpret and route correctly.
- **Zone C** is the only place the "visual evidence" deliverable can live — bounding boxes, grounding masks, and change highlights are meaningless as text.
- **Zone D** is the plain-English answer for the non-expert user — this is the layer that makes the tool usable by someone who has never opened QGIS.
- **Zone E** is the jury-facing layer: the query itself plus the auditable execution summary the PS explicitly names as a deliverable.

---

## 4. Zone-by-zone feature breakdown: what each tool does and how it's used

### 4.1 Zone A — Status / Context Bar
**Purpose:** continuously prove the "input compatibility checking engine" requirement is real, not decorative.

- **Format/metadata readout**: file type (GeoTIFF/TIFF vs PNG/JPEG-benchmark), band count, detected modality (optical/multispectral vs SAR), and — where applicable — a co-registration check result for paired inputs. This is a passive status strip, always visible, so a judge never has to ask "did it check the files?"
- **Mode indicator**: a persistent label showing which of the three input configurations is active (Single / Cross-Modal Pair / Bi-Temporal Pair), so the query console below is never ambiguous about what it's operating on.
- **Efficient use**: this bar is read-only and non-interactive by design — it's a trust signal, not a control surface. Keeping it out of the way (thin, top-anchored, muted) means it informs without competing for attention with the canvas.

### 4.2 Zone B — Input & Mode Rail
**Purpose:** turn the PS's three input scopes into three unambiguous, separately-testable upload flows, plus the AOI tools the grounding task needs.

- **Mode selector (three explicit tabs/toggles):**
  1. *Single Image* — one optical/multispectral or SAR file.
  2. *Cross-Modal Pair* — one optical + one SAR file of the same area.
  3. *Bi-Temporal Pair* — two same-modality images at t1/t2.
  Forcing an explicit choice (rather than "just drag files and we'll guess") does two things: it prevents silent misclassification, and it mirrors exactly the controller's own task-routing logic back to the user, which doubles as a teaching moment for the jury about how orchestration works.
- **Per-slot upload targets**: each mode shows the exact number of upload slots it needs (1, or 2 labeled "Optical" / "SAR", or 2 labeled "T1" / "T2") — never a generic multi-file dropzone that leaves modality ambiguous.
- **Inline validation feedback**: immediate reject/accept per file (format supported, benchmark-only formats flagged as such, dimensions/CRS mismatch on pairs surfaced before a query is even allowed).
- **AOI (Area of Interest) tools**: bounding-box draw and polygon draw on the canvas, used to scope grounding/VQA queries ("count the buildings in this box" vs the whole scene) and to keep inference fast on large scenes.
- **Benchmark query shelf**: one-click chips for the PS's own representative queries (*"Describe the land-cover and major objects visible in this image,"* *"Highlight the water body referred to in the query,"* etc.) — this de-risks live demos and doubles as a self-documenting example of scope for anyone new to the tool.
- **Efficient use**: because the mode choice happens before upload, users never fill the wrong slots; because AOI drawing lives on the canvas itself rather than a separate dialog, scoping a query is a two-second drag, not a modal detour.

### 4.3 Zone C — Image Canvas (the evidence surface)
**Purpose:** this is where three of the five mandatory requirements become visually self-evident — captioning/grounding, change detection, and cross-modal fusion all have to be *seen*, not just described.

- **Single-image view**: the uploaded scene at native resolution/zoom, with grounding results rendered as an overlaid box or mask exactly where the model claims the referenced object is, plus hover tooltips (area, confidence) on any detected feature.
- **Cross-modal view**: optical and SAR shown either as a synchronized side-by-side pair or a draggable swipe/wipe curtain, so a user can drag from "optical view (clouded/occluded)" to "SAR view (structure visible through cloud)" and *feel* why fusion matters, not just read a claim that it happened.
- **Bi-temporal view**: same swipe/curtain pattern between t1 and t2, plus a change-highlight layer (polygon or heatmap) rendered directly on top once change detection/change-VQA has run, so "what changed and where" is answered spatially as well as in text.
- **Band/layer toggle** (where multispectral data is available): true-color vs false-color/NIR vs SAR-amplitude views, letting a user or judge confirm the system is genuinely reading spectral bands rather than treating the image as an RGB photo — this is a direct, visible rebuttal to the "generic VLM" disqualification risk.
- **Efficient use**: one canvas, one interaction model (pan/zoom/swipe) reused across all three modes means a user who learns it once never has to relearn it for change detection vs cross-modal — the *content* changes, the *controls* don't.

### 4.4 Zone D — Answer & Evidence Card
**Purpose:** the plain-English deliverable for the non-expert user named directly in the PS's background section.

- **Direct answer**: a short, unhedged natural-language response to the exact question asked — this is the VQA/change-VQA payload, written for someone who has never heard of GSD or co-registration.
- **Supporting facts strip**: 2–4 quantified facts pulled from the same inference (e.g., an area figure, a count, a percentage change) — gives the answer teeth without turning it into a report.
- **Confidence indicator**: a simple score/label per answer, since the PS's controller spec explicitly requires the system to "estimate confidence."
- **"Why" link into the trace**: a single control that expands Zone E scrolled to the exact stage relevant to this answer — so a curious user (or a skeptical judge) is one click from the mechanism, without the default view being cluttered by it.
- **Efficient use**: this card is deliberately short — one answer, a few numbers, one confidence tag — so a non-expert gets what they came for immediately, while the escalation path to full evidence is always present but never forced on them.

### 4.5 Zone E — Query Console + Agentic Execution Trace
**Purpose:** this is the zone that directly answers the PS's evaluation rule — "only the observable execution trace... will be evaluated." If this zone is weak, the project fails the grading criterion regardless of backend quality.

- **Query input**: a single natural-language field, always visible, that accepts free text and also accepts the benchmark-query chips from Zone B.
- **Execution trace (collapsible drawer, default collapsed for casual use / default expanded in demo mode)**, showing, per query, in order:
  1. Task classification result (e.g., `BI_TEMPORAL_CHANGE_DETECTION`) with its confidence.
  2. Input compatibility check result (format/modality/co-registration — pass/fail with the actual figure, e.g. registration delta).
  3. Model/tool selected from the registry, with the exact parameters used (this is the PS's "permitted task parameters" requirement — showing that only *allowed* parameters were configurable, not arbitrary ones).
  4. Latency and any resource figures available.
  5. Output summary (what was produced — N polygons, a caption, an answer string) with a direct link to see it rendered in Zone C/D.
- **History list**: past queries in the session, each expandable to its own trace, so a user can compare "what happened when I asked X" vs "what happened when I asked Y" without re-running anything.
- **Export controls**: one-click GeoJSON export (vector evidence) and a PDF/summary export bundling the answer, the trace, and a canvas snapshot — this satisfies the PS's "downloadable reports" deliverable line directly.
- **Efficient use**: keeping the trace collapsible means it never gets in the way of a fast domain-user query, but making it one click away — and auto-opening it during a scripted demo — means the jury-facing proof is never more than a glance away either.

---

## 5. Mapping every PS deliverable line to a concrete UI element

So nothing in the "Expected Solution & Deliverables" section is left unaddressed:

| PS deliverable line | Concrete UI element |
|---|---|
| Input upload and compatibility checking engine | Zone B upload slots + Zone A status bar |
| Remote-sensing-adapted vision-language component | Model name literally shown in the trace (Zone E), never hidden behind a generic "AI" label |
| Specialist tools for VQA, captioning/grounding, change understanding, optical–SAR analysis | Zone C canvas modes (single / cross-modal / bi-temporal) + mode-specific overlays |
| Agentic controller for task routing, tool execution, output integration | Zone E execution trace, stage-by-stage |
| Visual evidence display | Zone C overlays (boxes, masks, change polygons) |
| Confidence scores | Zone D confidence tag + Zone E per-stage confidence |
| Execution summaries | Zone E trace, expandable per query |
| Downloadable reports | Zone E export controls (GeoJSON + PDF) |

---

## 6. Interaction flow — the four canonical journeys

These map 1:1 to the PS's representative benchmark queries, and should each be demoable end-to-end in under 60 seconds:

1. **Single-image describe/VQA**: select *Single Image* mode → upload one file → status bar confirms format/modality → type or pick "Describe the land-cover and major objects visible in this image" → answer appears in Zone D, trace shows `SINGLE_IMAGE_VQA` classification and the captioning/VQA model used.
2. **Text-guided grounding**: same single-image mode → query "Highlight the water body referred to in the query" → Zone C renders the mask/box in place → Zone D states what was found and its area → trace shows the grounding tool invoked with the text embedding as its parameter.
3. **Cross-modal fusion**: select *Cross-Modal Pair* → upload optical + SAR of the same area → query "Use the optical and SAR images together to identify built-up and water-covered regions" → canvas swipe/curtain lets the user drag between modalities → answer names both classes found → trace shows the fusion tool and both source images as inputs.
4. **Bi-temporal change**: select *Bi-Temporal Pair* → upload t1 + t2 → query "What changed between these two dates, and where did the change occur?" → canvas shows the change-highlight layer over the swipe curtain → Zone D gives the plain-English change summary and a quantified delta → trace shows the change-detection model, both timestamps as parameters, and (if available) a spatial change map reference.

---

## 7. Non-negotiable design principles (all derived from the "anti-wrapper" risk in the PS itself)

The PS's single biggest hazard is line: *"A general-purpose large language model (LLM) or vision-language model (VLM) cannot be expected to perform these specialised tasks reliably... The proposed solution must therefore include remote-sensing fine-tuning."* And the disqualification rule repeats this. The UI has direct responsibility for *not looking like* the thing that gets disqualified:

- **Never present a single centered chat box as the primary interface.** A chat-only layout visually signals "generic LLM wrapper" regardless of what runs underneath it. The map/canvas must be the primary surface; the query bar is a control on top of it, not the whole app.
- **Always name the model that ran**, never say "AI" generically. "RemoteCLIP" or "ChangeFormer" in the trace is worth more to a judge's confidence than any amount of visual polish.
- **Never let an answer appear without its supporting overlay**, where an overlay applies (grounding, change). Text-only answers for tasks that have a spatial component read as unverifiable.
- **Never hide the validation step.** Silently accepting any file undercuts the "input compatibility checking engine" deliverable; the UI should make rejection/acceptance visible even when nothing goes wrong.
- **Keep the trace real, not decorative.** Every field in Zone E must come from an actual backend value (real latency, real confidence, real parameters) — a judge who spots a static/fake number in the trace does more damage to credibility than an ugly UI ever could.

---

## 8. Suggested priority order if time is constrained

Given the PS's own weighting (mandatory scope first, held-out ISRO/SAC evaluation second), if the full report above cannot be built before a deadline, this is the order that preserves the most graded requirements per hour of frontend work:

1. Zone B mode selector + Zone A validation status (cheap to build, unlocks correct routing for everything else).
2. Zone D answer card + Zone E basic trace (this is the deliverable the "auditable execution trace" rule is graded on — build it before polishing the canvas).
3. Zone C single-image view with grounding overlay (covers the mandatory single-image baseline).
4. Zone C bi-temporal swipe + change overlay (covers mandatory multi-image change analysis).
5. Zone C cross-modal swipe (covers mandatory cross-modal requirement).
6. Zone E export controls (covers the "downloadable reports" deliverable line — last because it's additive, not blocking, to the core evaluation).

---

*This report intentionally does not reference the current frontend implementation. Compare it against `frontend/src/` next to identify gaps, then decide what to keep, refactor, or rebuild.*
