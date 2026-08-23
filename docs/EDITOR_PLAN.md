# Canvas Editor Plan

**Branch:** `feat/editor`
**Route:** `/editor`
**Status:** research-backed plan — not yet implemented
**Depends on:** existing `/api/render`, SVG sanitizer, SMIL sprite pipeline, `profile_configs`

---

## 0. Is this possible?

**Yes — as a visual composer that compiles to GitHub-safe SVG. Not as a live React runtime on GitHub.**

GitHub READMEs cannot run React, JavaScript, or most CSS. The editor can *feel* like a React component canvas. The published artifact must still be a self-contained SVG (`<img>` via Camo), the same contract as `/api/render/{username}/{template}.svg`.

| User expectation | What we can actually ship |
|---|---|
| Drag and drop React-looking blocks onto a canvas | **Yes.** Palette of registered blocks; JSON scene graph; live preview. |
| Edit props (text, color, size, animation) on the canvas | **Yes.** Selection + property inspector. |
| Prebuilt animation styles | **Yes.** Named presets that compile to SMIL / CSS `@keyframes`. |
| Create new component *shapes* | **Yes, if “shape” means composing primitives** (rect, ellipse, text, path, sprite, group) and saving that recipe as a reusable block. |
| Drop arbitrary React/JSX that runs on GitHub | **No.** No hooks, no events, no DOM. Untrusted user JSX is also an XSS/RCE surface. |
| Embed a GIF and have it animate inside the SVG on GitHub | **Unreliable.** Convert GIF → sprite sheet + SMIL (same idea as Piskel / Spidey), do not nest `data:image/gif`. |

This is the same split [readme-aura](https://github.com/collectioneur/readme-aura) uses: React/JSX is an *authoring* language; [Satori](https://github.com/vercel/satori) compiles it to a static SVG; animations are injected after compile. Our product adds a visual editor and keeps the live GitHub-stats render URL.

**Do not build:** a Figma clone, a general SVGEdit, or a sandbox that `eval`s user React.

**Do build:** a constrained canvas (fixed artboard), a block registry, a custom-shape composer, and a compile path that reuses the existing sanitizer.

---

## 1. Product goal

A new **Editor** view at `/editor` where a signed-in user can:

1. Start from a blank artboard (or a starter layout).
2. Drag prebuilt blocks onto the canvas (stats, text, badges, sprites, shapes).
3. Create custom shapes from primitives and save them as reusable blocks for their account.
4. Apply named animation styles.
5. Bind blocks to live GitHub data (`{{contributions}}`, `{{languages.0}}`, etc.).
6. Preview the compiled SVG (the same bytes GitHub will show).
7. Save the scene and get an embed URL:  
   `https://…/api/render/{username}/canvas.svg`

The existing form builder at `/` stays. Editor is a second product surface, not a rewrite of Phase 7.

---

## 2. Non-goals (v1)

- Infinite canvas / pan-zoom whiteboard (tldraw).
- Freehand drawing / Bézier path editor.
- Multiplayer collaboration.
- Arbitrary user-uploaded React packages or npm imports.
- Hover / click interactivity inside the README image (GitHub `<img>` cannot do this; wrap the whole card in a markdown link instead).
- Pixel-perfect match between DOM preview and Satori output without a compile step — **the preview must go through the compiler.**

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  /editor  (client)                                          │
│  Palette │ Canvas (Craft.js) │ Inspector │ Layers │ Preview │
└────────────┬───────────────────────────────┬────────────────┘
             │ scene JSON                    │ POST /api/editor/preview
             ▼                               ▼
      profile_configs.scene            compileScene(scene, data)
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
              block → JSX AST         Satori (layout)          SMIL / <style>
              (registry)              Yoga flexbox             post-process
                    └────────────────────────┬────────────────────────┘
                                             ▼
                                    sanitizeSvg()  (existing)
                                             ▼
                          GET /api/render/{user}/canvas.svg
```

### 3.1 Dual preview

| Surface | Engine | Why |
|---|---|---|
| **Edit canvas** | React + Craft.js | Drag, resize, snap, select. Fast. May look slightly different from GitHub. |
| **GitHub preview pane** | Server compile (`satori` + SMIL inject + sanitize) | Source of truth. Debounced, same as today’s preview URL. |

Never ship an embed from the DOM canvas alone. The compile path is the product.

### 3.2 Why Craft.js (not tldraw / SVGEdit)

| Tool | Verdict |
|---|---|
| **Craft.js** | Fits. Headless drag-drop page editor. Blocks are React components. Scene serializes to JSON. MIT. |
| **tldraw** | Wrong shape. Infinite whiteboard, drawing-first, heavy. |
| **SVGEdit** | Vector drawing, XSS-heavy, not a component composer. |
| **Custom from scratch** | Possible later; Craft.js gets selection/history/layers for free. |

Craft.js nodes **are** React components in the editor. At compile time they are **not** executed on GitHub — a server resolver maps each node type to a Satori-safe JSX tree (or raw SVG fragments for SMIL sprites).

---

## 4. Scene data model

Persist one JSON document per user (or per card). Do not store executable code.

```ts
type SceneNode = {
  id: string;
  type: BlockType;          // registry key, e.g. "statPill" | "shape.rect" | "user.abc123"
  x: number; y: number;
  w: number; h: number;
  rotation?: number;
  z: number;
  locked?: boolean;
  visible?: boolean;
  animation?: AnimationPresetId | CustomAnimation;
  props: Record<string, unknown>;  // validated against the block schema
  children?: SceneNode[];          // groups / user-defined shapes
};

type EditorScene = {
  version: 1;
  width: 800;
  height: 400;
  background: { fill: string; radius?: number };
  nodes: SceneNode[];
};
```

**Validation:** every `type` must exist in the server registry (built-in **or** that user’s saved custom shape). Unknown types are dropped at compile, not executed.

**GitHub bindings:** string props may contain tokens:

```
{{login}} {{name}} {{bio}}
{{stats.contributions}} {{stats.commits}} {{stats.prs}}
{{languages.0.name}} {{languages.0.pct}}
{{pinned.0.name}}
```

Resolved at render time from `github_data_cache`, same as current templates.

---

## 5. Prebuilt block registry

Each block has: React editor component, Zod (or similar) prop schema, Satori/SVG compiler, default size, thumbnail.

### 5.1 Layout / chrome

| ID | What it is |
|---|---|
| `artboard` | Root 800×400 (or 900×270, 1280×400 presets). Not draggable. |
| `group` | Nested frame. Drop target. |
| `stack` | Vertical / horizontal flex (Satori’s strength). |
| `spacer` | Empty flex grow. |

### 5.2 Content (data-aware)

| ID | Props (sketch) |
|---|---|
| `text` | content, font, size, color, weight, align |
| `statPill` | label, value token, accent |
| `statRow` | list of stats from GitHub cache |
| `languageBar` | languages map, bar colors, `barAnimation` |
| `avatar` | GitHub avatar as inlined PNG data-URI (fetched server-side) |
| `socialButton` | label, icon, fill — compile as SVG, wrap embed in `<a>` via block meta `link` |
| `pinnedRepo` | name, description, stars |

### 5.3 Shape primitives (the “create new shapes” kit)

| ID | Notes |
|---|---|
| `shape.rect` | fill, stroke, radius |
| `shape.ellipse` | |
| `shape.line` | |
| `shape.polygon` | regular n-gon |
| `shape.path` | **restricted** `d=` from a small path builder, not free Inkscape dumps |
| `shape.text` | SVG `<text>` (pixel-font option later) |
| `sprite` | existing Spidey / Octopuss / uploaded Piskel |

Primitives compile to raw SVG (`<rect>`, `<g>`, SMIL children), not Satori HTML, so IDs survive for animation targeting.

### 5.4 Assets

| ID | Pipeline |
|---|---|
| `image.static` | PNG/WebP/JPEG → data URI, cap 200 KB, no GIF |
| `image.gif` | Server: GIF → PNG strip + SMIL `animate` on `x` (extend `piskel.ts`) |
| `mascot.piskel` | Existing Piskel → rect sprite path |

---

## 6. Custom shapes (“create new React component shapes”)

Users do **not** write `.tsx` files. They **compose primitives on a mini-canvas**, name the result, and save it.

```
User builds:  [ellipse glow] + [rect body] + [text label]
         → saved as custom block type "user.{id}"
         → appears in palette under "My shapes"
         → droppable on the main artboard like any built-in
```

**Storage:** `custom_blocks` table (or jsonb on the user):

```ts
type CustomBlock = {
  id: string;
  userId: string;
  name: string;
  thumbnailSvg: string;      // sanitized
  root: SceneNode;           // must only contain primitive types
  createdAt: string;
};
```

**Rules:**

- Custom blocks may only nest `shape.*`, `text`, `sprite`, `group`. No `statRow` inside a custom shape (data blocks stay top-level).
- Props can be **exposed**: e.g. mark the inner text node as `slot: "label"` so the inspector shows a Label field when the custom block is selected.
- Compile inlines the subtree; IDs are namespaced (`usr-{blockId}-…`) with existing `namespaceDefs()`.
- Sharing / gallery is post-v1.

**Later (v2, optional, gated):** a code pane that edits a **Satori-safe JSX subset** for that user’s custom block, parsed with Sucrase like readme-aura, executed in a `new Function` with **only** `createElement` + an allowlisted component map — never `eval` of free JS, never `require`, never network. This is extra attack surface; do not start here.

---

## 7. Animation styles

Named presets. The inspector never asks users to write SMIL.

### 7.1 Preset catalog (v1)

| ID | Compiles to | Safe properties |
|---|---|---|
| `none` | — | |
| `fade` | CSS or SMIL opacity | `opacity` |
| `pulse` | SMIL opacity 0.6↔1 | `opacity` |
| `float` | `animateTransform` translate | `transform` |
| `spin` | `animateTransform` rotate | `transform` |
| `wiggle` | small rotate keyframes | `transform` |
| `draw` | `stroke-dashoffset` | stroke only |
| `barFill` | existing `BarStyle` (`ease-out` / `bounce` / `linear` / `step`) | width via clip or scaleX |
| `spriteCycle` | existing sprite `animate` on `x` | images / piskel |

**Hard rule:** only `transform`, `opacity`, `fill`, `stroke`, `stroke-dasharray` / `stroke-dashoffset`. Layout (`width`, `height`, `margin`) is unreliable in SVG-as-image.

### 7.2 Targeting

Compiler assigns stable `id`s (`n-{nodeId}`). Presets attach `<animate>` / `<animateTransform>` or a `<style>` block scoped to that id.

### 7.3 GitHub reality (overrides old Project_Plan note)

Camo **does** play SMIL in README `<img>` SVGs. CSS `@keyframes` in `<style>` often work in Chromium; Firefox has edge cases. Prefer SMIL for anything we promise “works on GitHub.” Scripts and `<foreignObject>` stay forbidden — the sanitizer already strips them.

---

## 8. Compile pipeline

New module: `src/lib/editor/compile.ts`.

```
scene JSON + GithubDataCache
  → resolve {{tokens}}
  → walk nodes:
       if type is Satori block  → build JSX element
       if type is shape/sprite  → build SVG fragment (keep ids)
  → satori(jsxRoot) for flex/text/gradient chrome
  → splice SVG fragments into slots (or render an SVG-only scene if no Satori nodes)
  → inject <style> / SMIL from animation presets
  → inline fonts/images
  → sanitizeSvg()
  → return string
```

**readme-aura to borrow (pattern, not a hard dependency):**

- Sucrase JSX → element tree
- Extract `<style>` before Satori, inject after
- Local images → data URIs

**We keep our own:** sanitizer allowlist, Piskel/SMIL sprites, live `/api/render`, GitHub GraphQL cache.

Add npm deps only when implementing: `satori`, `@craftjs/core` (and later `sucrase` if we add the gated JSX pane).

---

## 9. Routes and APIs

| Method | Path | Role |
|---|---|---|
| `GET` | `/editor` | Canvas UI (auth-gated; redirect to `/` if logged out). |
| `GET` | `/editor/shapes` | Optional: custom-shape studio (can be a modal on `/editor` in v1). |
| `POST` | `/api/editor/preview` | Body: scene JSON. Returns `image/svg+xml`. Debounce 300ms client-side. |
| `PUT` | `/api/editor/scene` | Save scene + bump `configHash`. Auth required. |
| `GET` | `/api/editor/scene` | Load saved scene. |
| `POST` | `/api/editor/blocks` | Save a custom shape. |
| `GET` | `/api/editor/blocks` | List the user’s custom shapes. |
| `GET` | `/api/render/{username}/canvas.svg` | Published embed. Same headers/ETag as existing render route. |

Extend `TemplateId` with `"canvas"`. Update the render route allowlist (today it is `pixel | arcade | fastfetch`).

---

## 10. UI layout (`/editor`)

```
┌──────────────────────────────────────────────────────────────┐
│  Pixel Profile   [Builder]  [Editor]          GH avatar      │
├────────┬─────────────────────────────────────┬───────────────┤
│ Palette│                                     │ Inspector     │
│ Built-in│         Artboard 800×400           │ node props    │
│ Shapes │         snap-to-8px grid            │ animation     │
│ My     │         selection handles           │ GitHub bind   │
│ shapes │                                     │               │
│        ├─────────────────────────────────────┤ Layers        │
│        │ GitHub preview (compiled SVG <img>) │ z-order       │
└────────┴─────────────────────────────────────┴───────────────┘
│  Save    Copy embed    Artboard size    Zoom 50/100/200      │
└──────────────────────────────────────────────────────────────┘
```

Nav: add Editor next to the current builder so `/` and `/editor` coexist.

**Canvas UX (v1):**

- Drag from palette onto artboard
- Move / resize (min size per block)
- Snap to 8px grid; optional align guides
- Undo / redo (Craft.js history)
- Delete, duplicate, lock
- Multi-select later (nice-to-have)

**Custom shape flow:**

1. “New shape” opens a 256×256 (or user-set) sub-canvas with only primitives.
2. User draws/composes, names it, exposes slots.
3. Save → appears under “My shapes.”

---

## 11. Security

Reuse `src/lib/svg/sanitize.ts`. Do not weaken it for the editor.

| Threat | Mitigation |
|---|---|
| XSS in SVG | Existing allowlist; no `<script>`, `on*`, `<foreignObject>`, external hrefs |
| User JSX / `new Function` | Not in v1. Custom shapes = JSON primitives only |
| Huge scene / GIF | Caps: scene JSON 200 KB; artboard max 1280×640; GIF frames 256; upload 5 MB (existing) |
| ID collisions | `namespaceDefs()` per custom block / user asset |
| Prototype pollution in props | Schema-validate every `props` object; drop unknown keys |
| SSRF via `{{avatar}}` / image URLs | Only fetch GitHub avatar from cached `avatarUrl`; no arbitrary URL images in v1 |

Preview and published render **must** both run `sanitizeSvg` on the final string.

---

## 12. Persistence

Minimal schema change:

```sql
-- extend profile_configs
alter table profile_configs
  add column if not exists scene jsonb;

-- custom shapes
create table if not exists custom_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  root jsonb not null,
  thumbnail_svg text not null,
  created_at timestamptz not null default now()
);
```

`template_id = 'canvas'` when the published card is the editor scene. Existing pixel/arcade/fastfetch rows unchanged.

---

## 13. Phased delivery

### Phase E0 — Spike (3–5 days)

Prove compile + GitHub, no Craft.js yet.

- Add `satori` (+ a bundled font, Inter or existing pixel path).
- `src/lib/editor/compile.ts`: hard-coded scene of `text` + `statPill` + `shape.rect` with `pulse`.
- `POST /api/editor/preview` and `GET /api/render/…/canvas.svg` (stub username).
- Embed the result in a test README. Confirm SMIL plays on github.com.

**Exit:** compiled SVG animates in a real README `<img>`.

### Phase E1 — Route + static canvas (1 week)

- `src/app/editor/page.tsx`
- Artboard, palette of 6 built-ins, inspector (no drag library yet — click-to-add + arrow-key nudge is OK).
- Save/load scene JSON.
- Preview pane wired to `/api/editor/preview`.

**Exit:** user can assemble a card without Craft.js.

### Phase E2 — Drag and drop (1–2 weeks)

- `@craftjs/core` (or a thin pointer-event canvas if Craft.js fights Satori types).
- Drag from palette, resize, layers, undo.
- Snap grid.

**Exit:** feels like an editor.

### Phase E3 — Animations + assets (1 week)

- Preset dropdown on selected node.
- GIF → SMIL strip (share Piskel decoder ideas).
- Bind GitHub tokens in text/stat blocks.

**Exit:** animated sprite + fade/float on a live-data pill.

### Phase E4 — Custom shapes (1–2 weeks)

- Shape studio (primitives only).
- Save to `custom_blocks`.
- Slots → inspector fields.
- Namespace IDs on compile.

**Exit:** user-made “badge” shape reusable on the main canvas.

### Phase E5 — Polish

- Starter layouts (hero + stats, terminal strip, social row).
- Mobile: read-only preview; edit is desktop-first.
- Snapshot tests for compile output (same spirit as template tests).
- Sanitizer corpus: malicious `d=`, CSS in custom thumbnails.

---

## 14. File map (proposed)

```
src/app/editor/page.tsx
src/app/api/editor/preview/route.ts
src/app/api/editor/scene/route.ts
src/app/api/editor/blocks/route.ts
src/components/editor/
  editor-shell.tsx
  palette.tsx
  canvas.tsx
  inspector.tsx
  layers.tsx
  preview-pane.tsx
  shape-studio.tsx
src/lib/editor/
  types.ts
  registry.ts          # built-in blocks
  compile.ts
  animations.ts
  tokens.ts            # {{bindings}}
  schema.ts            # scene validation
```

Extend `src/types/index.ts` (`TemplateId`), `src/lib/render/service.ts`, and the render route allowlist.

---

## 15. Testing

| Area | Assertion |
|---|---|
| Compile snapshots | Golden SVG for a fixture scene |
| Token resolve | Missing language index → empty string, not throw |
| Sanitizer | Custom shape with `<script>` in path/text → reject |
| Registry | Unknown `type` dropped |
| GIF pipeline | Frame cap / size cap throw |
| Render route | `canvas` template + existing three still 404 on junk ids |

Do not hit live GitHub in unit tests (existing `github-api` stub pattern).

---

## 16. Risks

| Risk | Mitigation |
|---|---|
| Satori layout ≠ Craft.js layout | Always show compiled preview; document “edit view is approximate” |
| Vercel Hobby CPU / 10s timeout | Cap node count (e.g. 40); keep compile sync and small |
| Craft.js + Next 16 / React 19 | Spike in E2; fallback to a small custom DnD if it breaks |
| Users expect Photoshop | Keep palette opinionated; copy: “README card studio, not a vector editor” |
| File size of inlined sprites | Existing sprite/Piskel caps; refuse huge GIFs |

---

## 17. Decision log

| Decision | Choice | Why |
|---|---|---|
| Editor location | New route `/editor` | Don’t destabilize `/` builder |
| Published format | SVG via `/api/render/…/canvas.svg` | Same Camo/embed story |
| DnD library | Craft.js, after E1 | Proven React block editor; spike-gated |
| Custom components | JSON primitive composition | Safe, GitHub-compatible, no `eval` |
| Animations | Named SMIL presets | Proven on GitHub; sanitizer already allows SMIL |
| GIF | Convert to SMIL sprite | Nested GIF in SVG does not reliably animate on Camo |
| readme-aura | Borrow compile patterns | Do not adopt its Action/static-README product model |

---

## 18. Immediate next step

When implementation starts: **Phase E0 only.** One fixture scene, Satori + SMIL, `/api/editor/preview`, verify on a GitHub README. Do not install Craft.js or build the full UI until that SVG plays in Camo.
