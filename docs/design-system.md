# Design System — Buttons, Icons and Touch Targets

> Reference document for every agent-facing UI rule in BallerStats. It replaces the former
> `## Design System` section of `AGENTS.md` (which now only points here): anything not written in
> this file is lost from the guidelines. The stack context is SolidJS + Tailwind CSS 4 + DaisyUI 5
> (`corporate` theme) with icons from `lucide-solid`. UI code comments and docs are written in
> English, the app UI itself remains French.

## 1. Buttons are native elements

The application uses native `<button type="button">` elements styled with DaisyUI classes
(`btn`, `btn-primary`, `btn-square`, `btn-wide`, `btn-lg`, etc.). No wrapper component is used and
none may be introduced: recreating a `BsButton` (or any similar abstraction) above `<button>` is
**forbidden**. The component existed and was deliberately deleted — see the Git history for the
rationale. DaisyUI classes on the native element are the whole API.

Every button MUST carry an explicit `type` attribute (`type="button"` for actions, `type="submit"`
inside forms). Native elements keep native semantics for free: keyboard focus, `disabled`, ARIA.

## 2. Icon conventions

Icons come from `lucide-solid`. Exactly three patterns are allowed:

| # | Pattern | Rule |
|---|---------|------|
| 1 | Icon + text | The icon precedes the text (icon on the LEFT). |
| 2 | Icon alone | Square button with the `btn-square` class, no text. |
| 3 | 2 icons + text | The two icons surround the text (one on the left, one on the right). |

### Examples

```tsx
// Pattern 1: Icon + text (icon on the LEFT)
<button class="btn btn-primary" type="button">
  <Save />
  Enregistrer
</button>

// Pattern 2: Icon alone (btn-square)
<button class="btn btn-square" type="button">
  <Trash />
</button>

// Pattern 3: 2 icons surround the text
<button class="btn btn-primary" type="button">
  <ChartLine />
  Tableau des stats
  <ChevronRight />
</button>
```

### Anti-patterns

- ❌ Text followed by the icon (icon on the right) for a single-icon button — except an explicit
  semantic justification, such as a "next" action with an arrow.
- ❌ Icon alone without the `btn-square` class.
- ❌ Recreating a `BsButton` abstraction (component deleted — cf. Git history).

## 3. Touch-target sizing standard

The standard is settled. Do not renegotiate the numbers; apply them.

### Target device and usage

BallerStats is operated on a **tablet, with touch input, courtside**: fast repeated tapping while
standing, in a gymnasium. The user is not seated at a desk with a mouse. Fat-finger misses and
adjacent-target mis-taps are the primary failure mode this standard exists to prevent.

### The numbers

| Rule | Value | Meaning |
|---|---|---|
| Absolute floor | 44 px | Never crossed, by any target, under any circumstance. |
| Minimum target | 48 px | Minimum height of ANY interactive target on a tablet-facing screen. |
| Primary size | 56 px | Primary or frequently repeated actions (e.g. scoring taps). |
| Minimum spacing | 8 px | Between two adjacent targets. |

A `btn-square` target is square: its width equals its height, so a 48 px square target is
48 × 48 px. For non-square targets the 48 px floor applies to height, and width must be at least
the height of the text plus its paddings — never below 44 px.

## 4. DaisyUI mapping

The DaisyUI `corporate` theme sets `--size-field: 0.25rem` (4 px), and every button height is
derived from it (`height: calc(var(--size-field) * N)` with one multiplier per size class), as
measured in `node_modules/daisyui/components/button.css` (daisyUI 5.7.47):

| Class | Multiplier | Height | Tablet conformance |
|---|---|---|---|
| `btn-xs` | × 6 | 24 px | ❌ NON-CONFORMANT by default |
| `btn-sm` | × 8 | 32 px | ❌ NON-CONFORMANT by default |
| `btn` / `btn-md` | × 10 | 40 px | ❌ NON-CONFORMANT by default |
| `btn-lg` | × 12 | 48 px | ✅ conformant minimum |
| `btn-xl` | × 14 | 56 px | ✅ primary-action size |

Consequence: `btn-md` (40 px), `btn-sm` (32 px) and `btn-xs` (24 px) are **non-conformant by
default on a tablet-facing screen** unless a written justification is documented (where, why, and
what mitigation applies). `btn-lg` (48 px) is the conformant minimum for any interactive target and
`btn-xl` (56 px) is the primary-action size.

### Role to class to height table

| Role | Class | Height |
|---|---|---|
| Primary / frequently repeated action | `btn-xl` (optionally `btn-primary`) | 56 px |
| Standard secondary action | `btn-lg` | 48 px |
| Icon-only action | `btn-square btn-lg` (or larger) | 48 × 48 px |
| Destructive action | `btn-lg` + `btn-error`/`btn-warning` | 48 px |
| `btn-md` / `btn-sm` / `btn-xs` | only with a documented justification | 40/32/24 px |

## 5. Why `--size-field` is not rebased globally

`--size-field` is shared by **every** DaisyUI field component — buttons, inputs, selects,
checkboxes. Rebasing it (for instance to 0.3rem to raise all heights at once) would silently change
the geometry of every form control in the application, well beyond the button surface this standard
covers. Rebasing it globally is deliberately **NOT** part of this standard's application and must be
a separate, explicit decision with its own review. Until such a decision exists, conformance is
achieved per target by picking the conformant size class or adding a local utility
(such as `min-h-[3rem]`).

## 6. Where the codebase already stands

- `src/libs/utils/utils.ts` (`confirmAction`) already renders dialog cancel/confirm buttons with
  `min-h-[3rem]` (48 px): the 48 px floor is already applied de facto there.
- The project plan already committed to 56 px for primary actions, which `btn-xl` provides.

## 7. External references

| Standard | Rule | Official URL |
|---|---|---|
| WCAG 2.2 SC 2.5.5 (AAA) | Target Size: 44 × 44 CSS px | <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html> |
| WCAG 2.2 SC 2.5.8 (AA) | Target Size Minimum: 24 × 24 CSS px | <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html> |
| Apple Human Interface Guidelines | 44 × 44 pt minimum tap target | <https://developer.apple.com/design/human-interface-guidelines/buttons> |
| Material Design / Android | 48 × 48 dp target, 8 dp spacing | <https://m1.material.io/layout/metrics-keylines.html> |
| Microsoft guidelines | 7.5 mm / ~40 px heuristic, scaled by frequency and cost of error | <https://learn.microsoft.com/en-us/windows/apps/develop/input/guidelines-for-targeting> |

Every URL in the table above was fetched live on 2026-10-13 and returned HTTP 200. Two earlier links
were dead and have been replaced: `.../Understanding/target-size.html` (404) is now
`.../Understanding/target-size-enhanced.html`, and `.../accessible-design/accessibility-basics` (404)
is now the Material Design spec page carrying both the 48 dp target and the 8 dp spacing rule. The
Microsoft link points to its post-redirect canonical path. Re-check these URLs whenever the standard
is reviewed.

BallerStats sits above all of them: the 48 px minimum exceeds WCAG AAA (44 px), Material (48 dp
matches) and Microsoft's heuristic; the 44 px floor is the never-crossed backstop.

## 8. Conformance checklist

Apply to any UI change that adds or modifies an interactive element:

1. Native `<button>` with an explicit `type` and DaisyUI classes — no wrapper component.
2. Icons follow one of the three allowed patterns (icon left / icon alone + `btn-square` /
   two icons surrounding the text).
3. Every touch target is at least 48 px high (44 px absolute floor, never crossed).
4. Primary or frequently repeated actions use 56 px (`btn-xl`).
5. Adjacent targets are separated by at least 8 px.
6. Any use of `btn-md`, `btn-sm` or `btn-xs` on a tablet-facing screen carries a written
   justification in the change description.
7. No global rebase of `--size-field` — per-target classes/utilities only.
