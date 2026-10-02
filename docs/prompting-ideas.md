# Prompting Ideas (for a later session)

Source: Wes's interpretation of the new Claude prompting guide. These are ideas
to evaluate, not decisions. Nothing here has been implemented yet.

## 1. Say what to do, not what not to do
- Claude prompting works better when instructions are phrased positively
  (describe the desired behavior) rather than as prohibitions.
- **Action:** review the WesCrafter directive and rewrite any "don't / never /
  avoid" lines as positive instructions.
- Note: the directive was not in the repo when this was written (the repo only
  contains the README), so locate it first.

## 2. Replace the critic with `/goal` (Haiku)
- The `/goal` command uses Haiku.
- **Idea:** use `/goal` in place of the separate critic step, and skip the
  second call.
- **Open questions:** does `/goal` evaluate against the criteria the critic
  currently checks? What does the critic catch that a goal check might miss?

## 3. Prompt order: context first, task last
- Put background material first (character sheets, world info, etc.) and the
  actual task/request at the end.
- **Action:** reorder prompt assembly so reference material comes before the
  task instruction.

## Suggested next steps
1. Find and read the current WesCrafter directive and critic prompt.
2. Rewrite the directive in positive form.
3. Reorder prompt sections: background -> character sheets -> task.
4. Prototype the `/goal` replacement for the critic and compare output quality
   and cost against the two-call flow.
