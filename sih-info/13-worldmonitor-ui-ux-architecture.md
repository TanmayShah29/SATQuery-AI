# SatQuery AI: Revolutionary Minimalist UI/UX Architecture
**Inspiration & Benchmark:** [World Monitor (`worldmonitor.app`)](https://www.worldmonitor.app/dashboard) / [`koala73/worldmonitor`](https://github.com/koala73/worldmonitor)  
**Philosophy:** Minimalist, High-Information-Density, Zero-Clutter Situational Awareness (Palantir / NORAD Style)  
**File Location:** [`sih-info/13-worldmonitor-ui-ux-architecture.md`](file:///Users/tanmay/SIH-2026/sih-info/13-worldmonitor-ui-ux-architecture.md)  

---

## 1. Deconstruction of World Monitor's UI/UX Breakthrough

After reverse-engineering `worldmonitor.app` and its open-source repository `koala73/worldmonitor`, we identified the key architectural principles that give it that **instantaneous loading, dark-technical situational awareness** feel:

### A. The Performance Secret: Why It Loads the Whole Earth in <200ms
* **The Trap Most Apps Fall Into:** Beginners try to load satellite raster images (PNGs/JPEGs) of the entire planet at zoom level 0. This requires downloading 100+ MB of heavy images, causing seconds of lag and stutter.
* **World Monitor's Solution:** It uses **vector basemap tiles** from **OpenFreeMap** (`https://tiles.openfreemap.org/styles/dark`). 
  - The entire world at zoom 0–2 is tiny (~400 KB of compressed vector geometry).
  - It renders on the GPU in **under 150 milliseconds**.
  - Completely open-source, **100% free**, zero API keys, and zero rate limits.

### B. Hardware-Accelerated Hybrid Rendering Stack
* **Map Engine:** `maplibre-gl` (v5.16+) handles map projection, panning, zooming, and base geographic features.
* **Data Visualization Layer:** `@deck.gl/core` + `@deck.gl/mapbox` (`MapboxOverlay`) renders tens of thousands of data points, polygons, and satellite footprints via WebGL shaders at **constant 60 FPS** without dropping frames.
* **Hierarchical Level of Detail (LOD):**
  - **Global View (Zoom 0–4):** Minimal dark vector earth, glowing satellite orbit passes, and macro alert pulses.
  - **Regional View (Zoom 5–9):** Satellite scene acquisition footprints (Sentinel-1, Sentinel-2, Cartosat).
  - **Tactical View (Zoom 10+):** Streams actual high-resolution Cloud-Optimized GeoTIFFs (COGs) and AI change masks *only for the user's viewport*.

### C. Color Theory: "Not Visually Heavy, Distinctive & Easily Understandable"
World Monitor avoids "rainbow dashboard fatigue" by strictly adhering to a **monochromatic dark void with sparse, meaningful neon accents**:
* **Void Background:** `#0a0a0a` / `#020a08` (OLED-friendly, ultra-deep dark).
* **Card & Surface Background:** `#141414` with subtle `rgba(255, 255, 255, 0.03)` glass borders.
* **Borders:** Ultra-crisp, hairline borders `#2a2a2a` (no muddy drop shadows).
* **Text Hierarchy:** High-contrast clean greys (`#e8e8e8` primary, `#888888` secondary, `#555555` tertiary).
* **Typography:** Pure Monospace for telemetry (`SF Mono`, `JetBrains Mono`, `Cascadia Code`).
* **The 4 Semantic Sparks (Never used decoratively, only for meaning):**
  - ⚡ **Electric Cyan (`#00E5FF`):** Optical satellite tracks, detected water bodies, active query highlights.
  - 📡 **Radar Amber (`#FFB300`):** Sentinel-1 SAR radar backscatter, infrastructure changes, construction alerts.
  - 🟢 **Telemetry Green (`#00E676`):** Cloud-free acquisitions (<5% cloud cover), high AI confidence (>90%), operational status.
  - 🔴 **Emergency Crimson (`#FF1744`):** Severe flood washouts, structural damage, anomalous drop-outs.

---

## 2. SatQuery AI Studio: The Complete UI/UX Blueprint

We are adapting this exact architecture for **SatQuery AI (SIH26167)** to create an earth observation studio that feels like a national command center rather than a toy chatbot.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🛰️ SATQUERY AI]  [UTC 15:24:08]  [LAT 23.0300° N  LON 72.5800° E]  [ZOOM 1.8]  [STATUS: SATELLITES LIVE] │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                         │
│                                                                                                         │
│                                                                                         ┌─────────────┐ │
│                                                                                         │ LAYER PILTS │ │
│                                                                                         │ [•] Opt S2  │ │
│                                            GLOBAL                                       │ [•] SAR S1  │ │
│                                            EARTH                                        │ [•] Change  │ │
│                                           CANVAS                                        │ [•] Clouds  │ │
│                                      (MapLibre GL 60fps)                                └─────────────┘ │
│                                                                                                         │
│                         ┌──────────────────────────────────────────┐                    ┌─────────────┐ │
│                         │  PRE-EVENT (T1)   │   POST-EVENT (T2)    │                    │ INTEL AUDIT │ │
│                         │   March 2024      │      May 2024        │                    │ DRAWER      │ │
│                         │                   │                      │                    │ Conf: 96.4% │ │
│                         │           ◄─── [ ‖ ] ───►                │                    │ Lat: 310ms  │ │
│                         │            Swipe Divider                 │                    │ [Export JSON│ │
│                         └──────────────────────────────────────────┘                    └─────────────┘ │
│                                                                                                         │
│               ┌───────────────────────────────────────────────────────────────────────────┐             │
│               │ ⚡ Ask SatQuery: "What changed after the floods?" or "Pierce cloud cover"  │             │
│               └───────────────────────────────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Functional Components to Build

### 1. Minimalist Top Telemetry Bar (`HeaderHUD.tsx`)
* Left: Minimalist brand badge (`SATQUERY // ISRO SAC EDITION`) with a pulsing emerald status dot.
* Center: Real-time mission coordinates, active mouse cursor lat/lon (`23.0300° N, 72.5800° E`), camera elevation, and UTC time ticker.
* Right: Sensor availability chips with live badges:
  - `[S2-MSI: ONLINE]`
  - `[S1-SAR: ACTIVE]`
  - `[CARTOSAT: STANDBY]`

### 2. Full-Screen WebGL Earth Viewport (`EarthStudio.tsx`)
* **Initial State:** User opens the app and sees the entire planet rendered smoothly in Void Dark mode with subtle country borders and longitude/latitude graticules.
* **Instant Load Engine:** OpenFreeMap vector basemap style with zero latency.
* **Animated Satellite Ground Footprints:** Overlay showing real orbital tracks of Sentinel-2 and Sentinel-1 passes over India and the world.
* **Interactive Fly-To:** Typing a query or clicking a hotspot (e.g. *Ahmedabad*, *Assam*, *Kerala*) initiates a butter-smooth 60 FPS camera fly-to:
  ```typescript
  map.flyTo({
    center: [72.58, 23.03],
    zoom: 12.5,
    pitch: 20,
    speed: 1.6,
    curve: 1.2
  });
  ```

### 3. Interactive Split-Screen Swipe Curtain (`BitemporalSwipe.tsx`)
* When user investigates a bi-temporal query (*"What changed between March 2024 and May 2024?"*), the map canvas engages dual-synchronized viewports with a draggable central vertical divider.
* Left side shows **$t_1$ (Pre-event optical base)**.
* Right side shows **$t_2$ (Post-event change or SAR radar fusion)**.
* Judges can physically drag the slider to see the before/after difference with their own eyes.

### 4. Floating Command Bar (`CommandBar.tsx`)
* Minimalist, translucent glass search bar anchored at the bottom-center of the screen.
* Keyboard hotkey: `Cmd + K` (Mac) or `Ctrl + K` (Windows/Linux) to instantly focus.
* Quick preset pill chips:
  - `[⚡ Detect New Construction (T1 vs T2)]`
  - `[🌧️ Pierce Monsoon Clouds with Radar]`
  - `[🌊 Map Flood Inundation Polygons]`
  - `[🔍 Inspect ISRO SAC Ahmedabad]`

### 5. Right-Hand Intelligence & Audit Drawer (`IntelDrawer.tsx`)
* Minimal slide-out drawer that displays the AI evidence trace:
  - **Natural Language Answer:** Clear, jargon-free synthesis.
  - **Confidence Gauge:** Minimal radial bar (e.g. `96.4%`).
  - **Execution Latency:** Live hardware timer (e.g. `312 ms`).
  - **Models Dispatched:** `ChangeFormer-v2` + `MobileSAM` + `Sentinel-1 Engine`.
  - **Export Buttons:** One-click **Download GeoJSON** (for QGIS/ArcGIS) and **Generate PDF Mission Brief**.

---

## 4. Frontend Technology Stack & Package Blueprint

| Package | Version | Purpose in SatQuery AI |
|---|---|---|
| **`react` & `react-dom`** | `^18.3.1` | Modern UI runtime with Concurrent Mode. |
| **`vite`** | `^5.4.0` | Sub-second HMR bundler. |
| **`maplibre-gl`** | `^5.1.0` | Open-source WebGL map rendering engine (no Mapbox tokens). |
| **`@deck.gl/core` & `@deck.gl/mapbox`** | `^9.0.0` | GPU hardware-accelerated vector polygon & footprint rendering. |
| **`lucide-react`** | `^0.400.0` | Feather-weight minimalist icon set. |
| **`tailwindcss`** | `^3.4.0` | Tactical utility styling with custom CSS variables. |

---

## 5. Design Tokens (Tailwind & CSS Configuration)

```css
:root {
  /* Backgrounds */
  --bg-space: #07090e;
  --bg-surface: #0e121b;
  --bg-surface-hover: #161b28;
  --bg-glass: rgba(14, 18, 27, 0.75);

  /* Hairline Borders */
  --border-subtle: #1e2536;
  --border-strong: #2e3850;

  /* Typography */
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  --font-sans: 'Inter', system-ui, sans-serif;
  --text-primary: #f0f4fc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Tactical Semantic Accents */
  --accent-cyan: #00E5FF;
  --accent-amber: #FFB300;
  --accent-green: #00E676;
  --accent-crimson: #FF1744;
}
```

---

## 6. Implementation Action Plan

1. **Step 1: Scaffold React + Vite + Tailwind Frontend** in `frontend/`.
2. **Step 2: Configure MapLibre GL with OpenFreeMap Dark Basemap** (`https://tiles.openfreemap.org/styles/dark`) for instant global Earth rendering in <150ms.
3. **Step 3: Build the Header HUD** with live coordinates and satellite status.
4. **Step 4: Build the Floating Command Bar** wired to the FastAPI backend (`http://localhost:8000/api/query`).
5. **Step 5: Integrate Bitemporal Swipe Slider** and Cyan glowing GeoJSON polygon layers.
6. **Step 6: Build the Intel Drawer** with exportable GeoJSON and telemetry metrics.
