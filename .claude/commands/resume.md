---
description: Reboot this session from handoff.md and confirm before doing any work
---

Reboot yourself into this project. Do exactly this, in order, and nothing else yet.

1. Read `CLAUDE.md` — the constant rules for every session in this project.
2. Read `handoff.md` — the head of the linked list, and the truth about where the project is now.
3. Follow the 🔗 Pointer at the bottom of `handoff.md` to the active feature file and read it,
   including its **Verification Log**. An empty log means that feature is not done, whatever any
   other file implies.
4. Check reality against the docs: run `git log --oneline -5` and `git status --short`. Per the truth
   hierarchy in `CLAUDE.md`, actual system state beats any document. If they disagree, say so
   explicitly — do not quietly trust the docs.

Then summarise back in **exactly 3 bullets**:
- Where the project actually is right now, and what is verified working versus merely written down.
- What the active feature is and what its success criteria require.
- The specific next action you intend to take.

Finally, **confirm the "Next Up" items with the user before doing any work.** If reality and the docs
disagreed in step 4, raise that first — it matters more than the plan.

Do not write code, create files, or change anything until the user responds.
