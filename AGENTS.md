# Repository Guidelines

## Project Structure & Module Organization
ObjToSchematic is built around TypeScript modules under `src/`, grouped by renderer (`renderer.ts`), geometry (`voxel_mesh.ts`), import/export adapters (`importers/`, `exporters/`), and UI components (`ui/`). Shared math and utility code live in `src/util.ts` and the `util/` folder. Data assets such as palettes and textures live in `res/`, while localisation strings sit in `loc/`. Headless build scripts and support tooling are under `tools/`. Browser entrypoints originate at `src/main.ts` referencing `template.html` and `styles.css`. Tests mirror core modules in `tests/`, with fixtures in `tests/data/`.

## Build, Test, and Development Commands
Run `npm install` before first use. Use `npm run start` for the webpack dev server with hot reload, and `npm run dist` to emit production bundles in `dist/`. Type-check via `npm run build`. Enforce lint rules with `npm run lint`. `npm test` executes the Jest suite. Assets needed for voxel atlas generation are generated with `npm run atlas`, and automated regression conversion runs can be scripted with `npm run headless`.

## Coding Style & Naming Conventions
TypeScript is required; prefer named exports when modules host multiple utilities. Follow ESLint’s Google preset with 2-space indentation, semicolons, single quotes for strings, and `camelCase` identifiers. Keep file names lowercase with hyphens or underscores only when matching existing patterns (e.g., `block_assigner.ts`). Order imports using `eslint-plugin-simple-import-sort`. Document non-trivial functions with a brief JSDoc-style block describing parameters and units.

## Testing Guidelines
Jest with `ts-jest` powers unit tests. Place new specs in `tests/` and mirror the source file name (e.g., `src/ray.ts` → `tests/ray.test.ts`). Use `tests/preamble.ts` for shared setup. Provide deterministic fixtures in `tests/data/` rather than synthesizing inline. When adding rendering or geometry features, include assertions around edge cases (empty meshes, oversized palettes) and update baselines under `tests/__mocks__/`. Run `npm test` locally before opening a PR; add coverage notes when new features lack direct tests.

## Commit & Pull Request Guidelines
Write commits in the imperative mood (“Add voxel octree cache”) and keep them scoped to a single concern. Reference related GitHub issues with `Fixes #123` when applicable. Pull requests should describe the player-facing impact, outline testing performed, and add screenshots or GIFs when UI changes affect the canvas. Include a quick checklist confirming linting and tests have been run, and tag reviewers familiar with the touched subsystems (importers, renderer, tooling).
