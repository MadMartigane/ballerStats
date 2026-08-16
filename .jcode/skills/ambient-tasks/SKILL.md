# Ambient Tasks Skill

> **When to use**: This skill is loaded when the agent needs to read, execute, or manage tasks in `AMBIENT_TASKS.md`. It is relevant for ambient mode cycles, proactive work sessions, and any time the user references ambient tasks.
>
> **Purpose**: Provide a shared, version-controlled task queue that bridges interactive sessions (laptop) and autonomous ambient cycles (server). The file lives in the git repo so both machines see the same state without needing memory sync.
>
> **Scope**: Project-level task management for proactive work. Not for feature tracking or sprint planning. Keep it lightweight.

---

## The File

`AMBIENT_TASKS.md` lives at the **repository root**. It is committed to git and shared across machines. It is the single source of truth for proactive work requests.

---

## Task Format

```markdown
- [ ] [P1] Task description here
- [ ] [P2] Another task
- [x] [P1] Completed task
```

### Priority Levels

| Tag | Meaning | When to use |
|-----|---------|-------------|
| `[P1]` | High | Blocking work, bugs, broken tests |
| `[P2]` | Normal | Standard proactive work (refactors, missing tests, docs) |
| `[P3]` | Low | Nice-to-have, cleanup, non-urgent improvements |

### Status Markers

| Marker | Meaning |
|--------|---------|
| `- [ ]` | Pending — not started, available for execution |
| `- [~]` | In progress — an agent has claimed this task |
| `- [x]` | Done — task completed and verified |
| `- [-]` | Abandoned — task was attempted but blocked or rejected. Add a reason below. |

---

## Rules

### Reading Tasks

1. At the **start of any ambient cycle or proactive work session**, read `AMBIENT_TASKS.md`
2. Filter for tasks with status `- [ ]` (pending)
3. Sort by priority: P1 first, then P2, then P3
4. Within the same priority, older tasks (closer to top) go first

### Claiming a Task

1. Before starting work, mark the task as in-progress: change `- [ ]` to `- [~]`
2. Commit this status change immediately with message: `chore(ambient): claim task "<short description>"`
3. This signals to other machines/agents that the task is being worked on

### Completing a Task

1. Do the actual work (write tests, refactor, fix, document)
2. Follow all project conventions from `AGENTS.md` and loaded skills
3. Run `pnpm run check` and `pnpm run test` to verify the work
4. Mark the task as done: change `- [~]` to `- [x]`
5. Commit with message: `feat(ambient): complete task "<short description>"`
6. If the task produced code changes, they go in the **same commit** as the status update

### Abandoning a Task

If a task cannot be completed (blocked, unclear, wrong premise):

1. Change `- [~]` to `- [-]`
2. Add an indented note below explaining why:
   ```markdown
   - [-] [P2] Refactor the stats calculation module
     - Abandoned: the module was already refactored in commit abc1234
   ```
3. Commit with message: `chore(ambient): abandon task "<short description>" — <reason>`

### Adding Tasks

Both the user and the agent can add tasks:

1. Append to the end of the task list
2. Always include a priority tag `[P1]`, `[P2]`, or `[P3]`
3. Write clear, self-contained descriptions — the executor may have no other context
4. Reference specific files when relevant: `Add tests for src/components/bs-stats-card.tsx`

**Concrete examples from this codebase:**
```markdown
- [ ] [P2] Add unit tests for src/libs/utils/utils.ts — clone, getUniqId, downloadBlob have no coverage
- [ ] [P1] Add tests for src/libs/contact/contact.ts — isContactRelationship, getRelationshipLabel are untested
- [ ] [P3] Add tests for src/libs/rolling-number.ts — createRollingNumber animation logic
- [ ] [P2] Add tests for src/libs/match/championship-util.ts — getUniqueChampionships, groupMatchesByChampionship
```

**Bad task descriptions (too vague):**
```markdown
- [ ] [P2] Improve the code
- [ ] [P1] Fix bugs
- [ ] [P3] Make it better
```

---

## In-Code Markers

In addition to `AMBIENT_TASKS.md`, tasks can be marked directly in code:

```typescript
// AMBIENT: add unit tests for this function
// AMBIENT: this function is too long, consider extracting the validation logic
// TODO(ambient): replace deprecated API usage
```

When doing a scout pass (analyzing the codebase for proactive work), search for these markers with:
```
grep -rn "AMBIENT:\|TODO(ambient)" src/
```

If found, they should be added to `AMBIENT_TASKS.md` to centralize tracking, then the in-code marker can stay or be removed.

---

## Conflict Handling

Since multiple machines may edit `AMBIENT_TASKS.md`:

1. **Always pull before editing**: `git pull --rebase` before claiming or completing a task
2. **Status changes are atomic**: a single commit should only change the task status, not the task description
3. **If two agents claimed the same task** (merge conflict on the same line): the second to merge keeps its claim, the first agent should find another task. Do not force the issue.
4. **Completed tasks are never reopened**: if the work regresses, create a new task

---

## Interaction with Project Conventions

When executing a task, the agent must follow:

- **AGENTS.md** — all project guidelines
- **SolidJS skill** — for any `.tsx`/`.ts` work
- **Biome formatting** — run `pnpm run fix` before committing
- **Commit conventions** — see the git-commit-messages skill or use the `chore(ambient)` / `feat(ambient)` prefixes defined above

Never bypass these conventions, even for small changes. Ambient work that breaks linting or tests is worse than no ambient work.
