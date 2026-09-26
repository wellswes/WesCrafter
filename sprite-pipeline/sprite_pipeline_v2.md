# Sprite Pipeline v2 — Working Notes

*Status: in progress (started 2026-09-26). Replaces the old ComfyUI Klein → Miraclein → ReActor pipeline (see Drive: `wesai_sprite_pipeline.md`).*

**Core problem:** faces break across too many generations. Each regeneration redraws the face slightly differently, and the drift compounds.

---

## The Pipeline (Wes's vision)

### Phase 1 — Create the character
1. **Concept** — work out the character with Claude (Myra).
2. **Generate in GPT** — first image.
3. **Check** — age reads right, visuals match concept, every required feature present.
4. **Enhance on RunPod** — same enhancement model used on Comfy (name TBD). Output = **enhanced master**.

### Phase 2 — Hair masters
5. **GPT variations** — from the enhanced master, create outfit + hairstyle masters. Outfits are tasteful but show body attributes clearly so later images can use them.
6. **Enhance** — yields ~5 enhanced **hair masters**.

### Phase 3 — Wardrobe & body
7. **Wardrobe** — build outfits from the enhanced hair masters.
8. **Nude master + swimsuit master** — made on RunPod from the best hair master.

### Phase 4 — Poses & final output
9. **Pose process (RunPod)** — prompt-driven. Uses the character plus *general* pose direction. Keep it loose: overly specific pose prompts produce unnatural results.
10. **Final pose enhancement + REMBG** — on RunPod or in Comfy on the PC.

---

## Why enhancement between generations matters
Wes's observation: enhancing between generations removes flaws before they compound. Correct — but it fixes **quality**, not **identity**.

| Drift | Cause | Fix |
|---|---|---|
| **Quality** (artifacts, softness, hands) | Flaws added each regeneration | ✅ Enhancement pass between generations |
| **Identity** (face slowly becomes someone else) | Each regeneration redraws the face | ❌ Not yet handled |

Enhancement sharpens whatever face it receives — it can't pull a drifted face back, and it can make drift look clean and intentional.

### Where identity drifts
- **GPT generations** — steps 2, 5, 7 (full redraw each time; chain compounds).
- **Prompted poses** — steps 8, 9 (full regeneration; highest risk, and it comes last).
- **Enhancement** — steps 4, 6, 8, 10 (depends on denoise strength).

---

## Proposed fixes

1. **Star, not chain.** Every GPT generation gets two references: the **enhanced master** (face) + the hair master/outfit (everything else). Prompt: "keep the face exactly as in image 1." Everything stays one step from the original face.
2. **Split enhancement into two parts:**
   - **Quality enhance** — current pass, unchanged.
   - **Face lock** — detect the face and re-render only that area, using the **original enhanced master** as identity reference (not the previous image). Drift gets pulled back every pass instead of carried forward.
3. **Check gate after every step** — not just step 3. Compare each new face to the master (by eye with a checklist, or an InsightFace/ArcFace similarity score run on RunPod). Drifted images get redone or face-fixed before they become a base.

---

## Open questions (Wes to check on the pod)
- [ ] Enhancement model name (checkpoint loader)
- [ ] Enhancement denoise strength
- [ ] Does the pose step run on the same model as enhancement?

Once known → pick the face-lock tool (native reference input, ReActor, face detailer + identity adapter, etc.) and draft the updated workflow.
