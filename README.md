# BallerStats

[![Formatted with Biome](https://img.shields.io/badge/Formatted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev/)
[![Linted with Ultracite](https://img.shields.io/badge/Linted_with-Ultracite-8b5cf6?style=flat)](https://github.com/nicolo-ribaudo/ultracite)
[![Tested with Vitest](https://img.shields.io/badge/Tested_with-Vitest-6da13f?style=flat&logo=vitest)](https://vitest.dev/)

Web app to collect and visualize your basketball player statistics.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or newer)
- [pnpm](https://pnpm.io/) (v9 or newer)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ballerStats.git
   cd ballerStats
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Start the development server
   ```bash
   pnpm run dev
   ```
   The dev server starts at http://localhost:3000

### Available Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Build for production |
| `pnpm run serve` | Preview production build |
| `pnpm run check` | Run Biome lint + format check |
| `pnpm run fix` | Auto-fix lint and format issues |
| `pnpm run format` | Format code with Biome (safe) |
| `pnpm run format-force` | Format code with Biome (unsafe) |
| `pnpm run test` | Run tests |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run test:coverage` | Run tests with coverage |

### Project Structure

```
ballerStats/
├── public/            # Static assets
├── src/
│   ├── components/    # Reusable UI components (Bs* prefix)
│   ├── global/        # Global state and configurations
│   ├── libs/          # Business logic and utilities
│   ├── pages/         # Page components (routes)
│   ├── index.css      # Global CSS
│   └── index.tsx      # Application entry point
├── biome.json         # Biome + Ultracite config (generated)
├── vitest.config.ts   # Vitest configuration
├── tsconfig.json      # TypeScript configuration
├── vite.config.ts     # Vite configuration
└── package.json       # Dependencies and scripts
```

### Code Style

- SolidJS functional components with TypeScript
- `Bs` prefix for component names (e.g., `BsButton`)
- Separate `.d.ts` files for component props
- Line width: 120 characters, 2-space indent, single quotes, semicolons as needed
- Linted and formatted by Biome via Ultracite

## Tech Stack

| Library | Purpose | Docs |
|---|---|---|
| SolidJS | UI framework | <https://docs.solidjs.com/> |
| TypeScript 6 | Type system | <https://www.typescriptlang.org/> |
| Vite 8 | Build tool | <https://vite.dev/> |
| Tailwind CSS 4 | Utility CSS | <https://tailwindcss.com/> |
| DaisyUI 5 | Component library | <https://daisyui.com/> |
| Lucide | Icons | <https://lucide.dev/> |
| Biome + Ultracite | Linting & formatting | <https://biomejs.dev/> |
| Vitest | Testing | <https://vitest.dev/> |

## License

MIT
