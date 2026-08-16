# BallerStats Development Guidelines

> **AI Coding Agents**: This file is the canonical reference for OpenCode, Mistral Vibe, and Claude Code.

## Tech Stack

- **Framework**: SolidJS 1.x with TypeScript 6.x
- **Build**: Vite 8.x (Oxc + Rolldown pipeline)
- **Styling**: Tailwind CSS 4.x + DaisyUI 5.x
- **Icons**: Lucide (lucide-solid) 1.x
- **Routing**: @solidjs/router 0.16.x (HashRouter)
- **Linting/Formatting**: Biome 2.x + Ultracite preset
- **Testing**: Vitest 3.x
- **Agent Skills**: SolidJS best practices (`.opencode/skills/solidjs/SKILL.md`) — auto-loaded for all `.tsx`/`.ts` work
- **Package Manager**: pnpm (ONLY — no npm)

## Commands

- `pnpm run dev` — Start dev server (port 3000)
- `pnpm run build` — Build for production
- `pnpm run serve` — Preview production build
- `pnpm run check` — Run Biome lint + format check
- `pnpm run fix` — Auto-fix lint and format issues
- `pnpm run format` — Format code with Biome (safe fixes)
- `pnpm run format-force` — Format code with Biome (unsafe fixes)
- `pnpm run test` — Run tests once
- `pnpm run test:watch` — Run tests in watch mode
- `pnpm run test:coverage` — Run tests with coverage report

## Code Style

- **Formatting**: Biome via Ultracite preset — line width 120, indent 2 spaces, semicolons as needed, single quotes
- **Imports**: Organized automatically by Biome
- **Types**: Separate `.d.ts` files for component props. Always use TypeScript interfaces/types
- **Components**: Functional component pattern with adaptor pattern. Keep presentational logic separate from business logic
- **Naming**: `Bs` prefix for component names (e.g., `BsButton`). camelCase for variables, PascalCase for types/interfaces
- **Error handling**: Descriptive error messages, proper TypeScript null checks

## Project Structure

```
src/
├── components/   # Reusable UI components (Bs* prefix)
├── global/       # Global state, theme, fonts
├── libs/         # Business logic, utilities, stores
├── pages/        # Page-level route components
├── index.css     # Global CSS (Tailwind)
└── index.tsx     # App entry point
```

## Architecture Notes

- **Router**: HashRouter with dynamic route registration via `NAVIGATION_MENU_ENTRIES`
- **State**: SolidJS stores (`createStore`) + custom signal wrappers (`MadSignal`)
- **Icons**: All imported from `lucide-solid` — check lucide.dev for available icons
- **Deployment**: `pre-prod` and `prod` scripts copy to `/var/www/` paths — Linux-only

## Ambient Tasks

> **Scope**: This section applies **only** to the ambient agent running proactive background cycles. Regular interactive dev sessions should **not** follow this workflow — it would disrupt normal development.

This project uses a version-controlled task queue for proactive work via ambient mode.

- **Task file**: `AMBIENT_TASKS.md` at the repository root
- **Skill**: `.jcode/skills/ambient-tasks/SKILL.md` — load this skill before reading or editing the task file
- **In-code markers**: `// AMBIENT:` and `// TODO(ambient):` in source files flag proactive work opportunities

### Rules for the ambient agent only

1. **Read `AMBIENT_TASKS.md` at the start of each ambient cycle** (not during interactive sessions)
2. Load the `ambient-tasks` skill before manipulating the task file
3. Search for `AMBIENT:` and `TODO(ambient):` markers in `src/` during scout passes
4. Task status changes (claim, complete, abandon) are separate commits with `chore(ambient)` or `feat(ambient)` prefixes
5. All work must pass `pnpm run check` and `pnpm run test` before marking a task done

## Design System

### Boutons

L'application utilise des éléments `<button>` natifs avec les classes DaisyUI (`btn`, `btn-primary`, `btn-square`, `btn-wide`, etc.). Aucune abstraction de composant n'est utilisée — ne pas recréer de composant `BsButton` au-dessus de `<button>`.

#### Conventions d'icônes

Les icônes proviennent de `lucide-solid`. Trois patrons sont autorisés :

| # | Patron                | Règle                                                                            |
|---|-----------------------|----------------------------------------------------------------------------------|
| 1 | Icône + texte         | L'icône précède le texte (icône à GAUCHE).                                       |
| 2 | Icône seule           | Bouton carré avec la classe `btn-square`, aucun texte.                           |
| 3 | 2 icônes + texte      | Les deux icônes encadrent le texte (une à gauche, une à droite).                 |

#### Exemples

```tsx
// Patron 1 : Icône + texte (icône à GAUCHE)
<button class="btn btn-primary" type="button">
  <Save />
  Enregistrer
</button>

// Patron 2 : Icône seule (btn-square)
<button class="btn btn-square" type="button">
  <Trash />
</button>

// Patron 3 : 2 icônes encadrent le texte
<button class="btn btn-primary" type="button">
  <ChartLine />
  Tableau des stats
  <ChevronRight />
</button>
```

#### Anti-patterns

- ❌ Texte suivi de l'icône (icône à droite) pour un bouton à icône unique — sauf justification sémantique explicite (ex. action « suivant » avec flèche).
- ❌ Icône seule sans la classe `btn-square`.
- ❌ Recréer une abstraction `BsButton` (composant supprimé — cf. historique Git).

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### Accessibility

- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components over `<img>` tags

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.
