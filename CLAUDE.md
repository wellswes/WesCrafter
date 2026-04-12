# WesAI — CLAUDE.md

## Project Overview

**WesAI** (Wes's Erotic Stories and Images) is a multi-story prose writing and visual novel authoring tool. It is designed to support a long-running novel series across multiple books, each with its own cast, locations, and story arc.

### Core objectives

**Easy workflow first.** Every feature exists to reduce friction for the author. The writing loop — directive → generate → review → accept — should be as fast and invisible as possible. UI decisions favor simplicity over features.

**Token conscious.** All AI calls are scoped to the minimum context needed. Haiku handles pipeline tasks (scene naming, event capture, codex updates). Sonnet handles prose generation only. Context fed to Sonnet is assembled deliberately — nearby locations, active characters, relevant history — not the entire DB.

**The author can edit everything.** All AI-generated content is a starting point, never a final state. Prose, scene names, chapter titles, codex updates, event summaries, character descriptions, relationships — every field the AI touches must be editable by the author. If a feature generates or displays content and the author cannot directly edit it in the UI, that is an incomplete feature. Build edit affordances first, not as an afterthought.

**Beats are the atomic unit.** All prose, scene state, image triggers, and pipeline processing attach at the beat level. Chapters and scenes are navigation structure only.

**The DB records current canon only.** Character sheets, relationships, and world data reflect the story as it stands — never planned arcs or future events.

**Multi-story architecture.** Characters belong to the world, not to stories. Stories cast characters via the `story_characters` join table. The tool supports many stories sharing the same world and cast.

**The import pipeline processes completed writing.** Steps 1-5 run after a chapter is written — consolidating, structuring, capturing events, and updating the codex. The pipeline is designed to be low-intervention and fully automatic where possible.

---

## Stack
- **Frontend:** React + Vite, deployed on Vercel
- **Backend:** Supabase (Postgres + Edge Functions)
- **AI:** Anthropic API via Supabase Edge Functions only — never called directly from the frontend
- **Routing:** React Router

---

## Deployment
- **Always deploy from `wescrafter-viewer/`**, not the repo root:
  ```
  cd wescrafter-viewer
  npx vercel --prod
  ```
- Running from repo root deploys the wrong directory and targets the wrong Vercel project.
- **Production URL:** `https://wes-crafter.vercel.app`
- **Do not deploy to** `wescrafter-viewer.vercel.app` — that is the old abandoned project.
- GitHub repo: `wellswes/WesCrafter` (case-sensitive)

---

## Supabase
- **Project ID:** `gjvegoinppbpfusttycs`
- **Project name:** WesCrafter2
- **Region:** us-east-1
- **Edge functions deployed via Supabase MCP tool only** — no local `supabase/` directory.
- All edge functions use `verify_jwt: false`.
- Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key) inside edge functions for DB writes.
- **`apply_migration` for DDL; `execute_sql` for DML** — never use `execute_sql` for schema changes.

## Key Constants
- `STORY_ID` (Safe Harbor): `ca821271-2bca-4b3c-bdf7-7224e0b4e8b3`
- `STORY_ID` (Unsafe Portal): `e1e98fe7-f58e-4a9b-8405-3caf4e633491`
- `WORLD_ID`: `96f993ca-19eb-4698-b0f7-e8ee94d7e8fc`
- Supabase URL/anon key: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars

---

## Edge Functions

| Slug | Purpose | Model |
|---|---|---|
| `generate-prose` | Generates narrative prose from a beat directive. Returns `{ prose, scene_state }` | `claude-sonnet-4-6` |
| `break-scenes` | Groups beats into named scenes + proposes chapter title. Handles ghost beat cleanup. | `claude-haiku-4-5-20251001` |
| `process-chapter` | Captures story events and relationship changes from chapter prose. | `claude-haiku-4-5-20251001` |
| `update-codex` | Updates character sheet fields from chapter events. | `claude-haiku-4-5-20251001` |

### Critical Edge Function notes
- The AI model reliably wraps JSON responses in markdown code fences despite instructions — **always strip fences before parsing.**
- Supabase secrets require redeployment to register in already-deployed Edge Functions.
- Deploy always requires the full `files` array with `name` and `content` fields — deploying with empty files array does nothing.

---

## Database Schema

### Core structure
- **stories** — `id, title, world_id, status`
- **chapters** — `id, sequence_number, title, story_id, context_summary, exclude_from_prompt`
- **scenes** — `id, chapter_id, title, sequence_number`
- **beats** — `id, scene_id, sequence_number, directive, prose_text, snap_location_id, snap_time_of_day, snap_scene_mode, snap_active_character_ids, snap_pov_character_id, snap_character_positions`

### Characters
- **characters** — `id, world_id, name, character_group, portrait_url, physical_appearance, personality, voice_notes, species, height_feet, height_inches, height_cm (generated), height_scale (generated), status`
  - `status`: `active` (cast in a story) or `reserve` (casting pool, unassigned)
  - `height_scale`: generated column, Roxy at 5'6" = 1.0 baseline
- **character_groups** — `id, name, color`
- **character_sprites** — `id, character_id, portrait_url, label, is_default, clip_type, mood_tag, webm_path, novelai_seed, novelai_prompt, source_filename`
- **story_characters** — `id, story_id, character_id, role` (junction — characters belong to world, cast into stories)

### World
- **places** — `id, name, parent_id, world_id` (unified hierarchical table — legacy geography tables dropped)

### Story intelligence
- **story_events** — AI-distilled relationship and story events by chapter
- **relationships** — `character_a_id, character_b_id, status, intimacy_level, tension_level, trust_level, dynamic_notes`

### Storage
- **Bucket:** `Wescrafter Images` (public)
- **Path pattern:** `[story_id_first8]/characters/[character_name]/[filename]`
- When a new character is created, create their storage folder with a `.keep` placeholder file.

### Schema gotchas
- `scenes` has a unique constraint on `(chapter_id, sequence_number)`. When reordering or inserting, use temp offset (10000+) then normalize back to 1-based.
- Generated columns (`height_cm`, `height_scale`) cannot use `ALTER COLUMN` to change to `GENERATED ALWAYS` — must drop and re-add.
- Scene reordering requires a three-step UPDATE using a temporary sequence number to avoid unique constraint conflicts.

---

## App Architecture

### Routes
- `/` — Main writing view
- `/codex` — Character codex
- `/characters` — Characters page with per-character Image Studio tab
- `/images` — Image Pipeline / Image Studio
- `/map` — Places map
- `/snap-debug` — Debug view

### Writing view layout
- **PortraitBand** — full-width top bar, active characters, drag-to-reposition
- **LeftPanel** — 220px sidebar with scene controls
- **Prose area** — white background, Georgia serif, 20px font; scrolls to TOP on new content load
- **WritePanel** — bottom input bar for directives

### Left panel controls (top to bottom)
1. Codex / Map links + Write → button
2. + character (portal dropdown, collapsible groups)
3. Chapter select (native `<select>`)
4. Location select (custom portal dropdown, collapsible hierarchy)
5. Time of day select (native `<select>`)
6. Narrative mode select (native `<select>`)
7. ↑ Pipeline button (pinned to bottom)

### Component files
- `constants.js` — shared constants
- `PortraitBand.jsx` — character portrait bar
- `WritePanel.jsx` — directive input and generate button
- `LeftPanel.jsx` — sidebar controls

---

## UI Theme
Light theme (white prose area, warm off-white sidebar):
- Prose panel: `#ffffff`
- Left panel: `#f5f2ec`
- Write panel: `#f0ece4`
- Prose text: `#1a2a3a`
- Prose font: Georgia, serif, 20px, line-height 2.0
- Amber accents: `#8B6914`
- Title font: Cinzel (Google Fonts) — app title only

Import Pipeline panel and overlays remain dark-themed (CSS variables `--bg`, `--gold` etc.).

---

## Key Behaviors

### Prose generation flow
1. User types directive → hits Generate (or Ctrl+Enter)
2. `generate-prose` returns `{ prose, scene_state }`
3. Pending prose appears in editable textarea below existing beats
4. Text frame anchored to top of display area
5. User edits if needed → Accept or Discard
6. Accept saves beat to DB

### Pending prose persistence
- `pendingProse` and `directive` persisted to `sessionStorage`
- Keys: `"pendingProse"`, `"directive"`

### Character dropdown
- Groups collapsible; state in `localStorage` key `"charDropOpenGroups"`
- All groups start closed by default

### Location dropdown
- Custom portal dropdown — collapsible hierarchy, fully recursive
- Collapse state in `localStorage` key `"locDropCollapsed"`

### Import Pipeline (↑ Pipeline)
Clicking the row triggers the action — no separate run button:

1. **Consolidate Beats** — calls `consolidate_beats` RPC
2. **Scene Breaks** — calls `break-scenes`; refreshes chapter title and scene list; shows scene names with beat counts
3. **Capture Events** — calls `process-chapter`, opens editable review panel
4. **Update Character Sheet** — calls `update-codex`, opens editable review panel
5. **Start New Chapter** — creates chapter (max sequence_number + 1, title "New Chapter"), one blank scene, one blank beat, navigates to it

On success each row turns green with checkmark. State resets on chapter change or panel close.