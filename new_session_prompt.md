# New Session Prompt

Paste everything below the line into a fresh Claude Code session started in this project folder.
(In Claude Code you can just type `/resume` instead — this file is the fallback for other environments.)

---

You are picking up an in-progress project. Do exactly this, in order, before anything else.

1. Read `CLAUDE.md` — the constant rules for every session here.
2. Read `handoff.md` — the head of the linked list and the truth about where things stand now.
3. Follow the 🔗 Pointer at the bottom of `handoff.md` to the active feature file and read it,
   including its **Verification Log**. An empty log means that feature is not done, regardless of
   what any other file suggests.
4. Check reality against the docs: run `git log --oneline -5` and `git status --short`. Actual system
   state outranks every document. If they disagree, say so explicitly rather than trusting the docs.

Then summarise back in **exactly 3 bullets**:
- Where the project actually is, separating what is verified working from what is only written down.
- The active feature and what its success criteria require.
- The specific next action you intend to take.

Then **confirm the "Next Up" items with me before doing any work.** If reality and the docs disagreed
in step 4, raise that first.

Do not write code, create files, or change anything until I respond.
