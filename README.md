# ballerStats

[![Formatted with Biome](https://img.shields.io/badge/Formatted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev/)

Web app to collect and visualize your player statistics

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or newer recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ballerStats.git
   cd ballerStats
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm run dev
   ```
   This will start the development server at http://localhost:5173 (or another port if 5173 is in use)

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run serve` - Preview production build
- `npm run check` - Run Biome to check code
- `npm run format` - Format code with Biome
- `npm run format-force` - Format code with Biome (unsafe mode)

### Project Structure

```
ballerStats/
├── public/            # Static assets
├── src/
│   ├── components/    # Reusable UI components
│   ├── global/        # Global state and configurations
│   ├── libs/          # Utility functions and helpers
│   ├── pages/         # Page components
│   ├── index.css      # Global CSS
│   └── index.tsx      # Application entry point
├── index.html         # HTML template
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite configuration
```

### Development Workflow

1. Make changes to the codebase
2. Format your code using `npm run format`
3. Check for linting issues with `npm run check`
4. Start the development server with `npm run dev` to preview changes
5. Build for production with `npm run build` when ready to deploy

### Code Style Guidelines

- Use SolidJS functional components with TypeScript
- Follow the naming convention: `Bs` prefix for component names (e.g., `BsButton`)
- Create separate `.d.ts` files for component props
- Line width: 120 characters, indentation: 2 spaces
- Use single quotes for strings
- Separate presentational logic from business logic

## Third-Party Libraries

- SolidJS
  <https://docs.solidjs.com/>

- Tailwindcss
  <https://tailwindcss.com/>

- Lucide (icons)
  <https://lucide.dev/>

- DaisyUI
  <https://daisyui.com/>

- SVGrepo
  <https://www.svgrepo.com/>
