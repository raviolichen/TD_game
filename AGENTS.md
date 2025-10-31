# Repository Guidelines

## Project Structure & Module Organization
The game runtime lives under `src/`, following Phaser’s scene/entity pattern. `src/main.js` boots the game and registers the active scene. `src/scenes/GameScene.js` orchestrates layout, UI, wave logic, and should remain the only scene touching Phaser lifecycle hooks. Entity behaviour stays inside `src/entities/` (`Tower.js`, `Enemy.js`), while balance data and crafting rules belong in `src/config/towerConfig.js`. Static scaffolding (`index.html`) mounts the canvas; release documentation sits in root Markdown files. Screenshots and visual references are archived in `截圖/`.

## Build, Test, and Development Commands
Run `npm install` once per machine. `npm run dev` launches the Vite dev server on `http://localhost:3000` with hot reload, ideal for balancing sessions. `npm run build` emits a production bundle to `dist/`, and `npm run preview` serves that bundle for smoke-testing a release candidate.

## Coding Style & Naming Conventions
Use modern ES modules with two-space indentation, trailing semicolons, and single quotes to match the existing code. Class files use PascalCase filenames (`Tower.js`), while exports inside modules remain camelCase. Prefer small pure helpers for calculations or targeting logic and avoid embedding long literal tables inside scene methods—move them to `src/config/` instead. Clean up any Phaser-managed objects within paired lifecycle hooks to prevent memory leaks between waves.

## Testing Guidelines
Automated tests are not yet wired up. Until Vitest or similar is introduced, validate changes by running `npm run dev`, exercising tower placement, crafting, and wave progression, and watching the browser console for warnings. If you add deterministic logic (such as damage formulas or spawn curves), provide focused helper functions and document manual verification steps in the pull request.

## Commit & Pull Request Guidelines
Write commits in the imperative mood (e.g., `Add splash damage timer`) and keep related work together. For pull requests, include a concise summary, link any tracking issue, enumerate manual test steps, and attach updated screenshots from `截圖/` when visuals change. Call out potential regressions (performance, balance, localisation) so reviewers can target playtests efficiently.
