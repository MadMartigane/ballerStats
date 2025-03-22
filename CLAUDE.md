# BallerStats Development Guidelines

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run serve` - Preview production build
- `npm run check` - Run Biome to check code
- `npm run format` - Format code with Biome
- `npm run format-force` - Format code with Biome (unsafe mode)

## Code Style
- **Framework:** SolidJS with TypeScript
- **Formatting:** 
  - Line width: 120 characters
  - Indentation: 2 spaces
  - Semicolons: as needed
  - Quotes: single quotes
- **Imports:** Use organized imports (Biome handles this automatically)
- **Types:** 
  - Create separate `.d.ts` files for component props
  - Always use TypeScript interfaces/types
- **Components:**
  - Follow functional component pattern with adaptor pattern
  - Keep presentational logic separate from business logic
- **Naming:** 
  - Use `Bs` prefix for component names (e.g., `BsButton`)
  - Use camelCase for variables, PascalCase for types/interfaces
- **Error handling:** Use descriptive error messages and proper TypeScript null checks