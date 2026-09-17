# BallerStats

[![Formatted with Biome](https://img.shields.io/badge/Formatted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev/)
[![Linted with Ultracite](https://img.shields.io/badge/Linted_with-Ultracite-8b5cf6?style=flat)](https://github.com/haydenbleasel/ultracite)
[![Tested with Vitest](https://img.shields.io/badge/Tested_with-Vitest-6da13f?style=flat&logo=vitest)](https://vitest.dev/)

Application web pour collecter et visualiser les statistiques de vos joueurs de basket.

## Démarrage rapide

Prérequis : [Node.js](https://nodejs.org/) 20 ou plus récent et [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/MadMartigane/ballerStats.git
cd ballerStats
pnpm run dev
```

`pnpm run dev` prépare l'environnement tout seul (dépendances, fichier `.env`, backend Nostromo) puis
démarre Vite sur <http://localhost:3000>. Rien à installer à la main. Sans backend joignable,
l'application démarre en mode local seul.

Menus du démarrage, backend local et variables d'environnement : [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Scripts

| Commande | Rôle |
|---|---|
| `pnpm run dev` | Préparation complète puis Vite (port 3000) |
| `pnpm run dev:vite` | Vite seul, sans préparation (dépannage) |
| `pnpm run build` | Build de production dans `dist/` |
| `pnpm run serve` | Prévisualise le build de production |
| `pnpm run start` | Alias de Vite seul |
| `pnpm run check` | Vérifie le lint et le format (Biome + Ultracite) |
| `pnpm run fix` | Corrige le lint et le format (`format` est un alias) |
| `pnpm run format-force` | Corrige aussi les corrections « unsafe » |
| `pnpm run test` | Tests Vitest (une passe) |
| `pnpm run test:watch` | Tests en mode watch |
| `pnpm run test:coverage` | Tests avec rapport de couverture |
| `pnpm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `pnpm run prod` / `pre-prod` | Build puis déploiement `/var/www/...` (Linux uniquement) |
| `pnpm run prod-only` / `pre-prod-only` | Copie sans rebuild (variantes `-clean` et `-push`) |
| `pnpm run prepare` | Installe les hooks husky (lancé automatiquement à l'installation) |

Le détail de chaque script est dans [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Stack technique

| Techno | Rôle |
|---|---|
| [SolidJS](https://docs.solidjs.com/) 1.x | Framework UI |
| [TypeScript](https://www.typescriptlang.org/) 7.x | Typage statique |
| [Vite](https://vite.dev/) 8.x | Serveur de développement et build |
| [Tailwind CSS](https://tailwindcss.com/) 4.x + [DaisyUI](https://daisyui.com/) 5.x | Styles et composants |
| [@solidjs/router](https://github.com/solidjs/solid-router) (HashRouter) | Routage |
| [Lucide](https://lucide.dev/) | Icônes |
| [Vitest](https://vitest.dev/) | Tests |
| [Biome](https://biomejs.dev/) + [Ultracite](https://github.com/haydenbleasel/ultracite) | Lint et format |

## Structure du projet

```
ballerStats/
├── docs/              # Références d'architecture
├── scripts/           # Outillage de développement (démarrage)
├── public/            # Assets statiques
├── src/
│   ├── components/    # Composants UI réutilisables (préfixe Bs*)
│   ├── global/        # État global, thème, polices
│   ├── libs/          # Logique métier, utilitaires, stores
│   ├── pages/         # Composants de route
│   ├── index.css      # CSS global (Tailwind)
│   └── index.tsx      # Point d'entrée de l'application
├── biome.json         # Configuration Biome + Ultracite
├── vite.config.ts     # Configuration Vite
├── vitest.config.ts   # Configuration Vitest
└── package.json       # Dépendances et scripts
```

## Conventions

- Avant de committer : `pnpm run check`, `pnpm run typecheck` et `pnpm run test` (le hook husky de
  pré-commit exécute déjà les deux premiers).
- Conventions de code, d'architecture et d'état : [`AGENTS.md`](AGENTS.md) et
  [`docs/state-architecture.md`](docs/state-architecture.md).
- Messages de commit en [Conventional Commits](https://www.conventionalcommits.org/), en anglais.

## Licence

MIT
