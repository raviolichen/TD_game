# Repository Guidelines

## Project Structure & Module Organization
The game is plain JavaScript with a Canvas 2D renderer; there is no game engine. `src/main.js` boots `src/ui/App.js`, which owns the DOM, input, and the fixed-timestep loop. Game rules live in `src/game/` and must stay DOM-free so they run under Node (`Game.js` state and combat, `maps.js` procedural maps, `waves.js` spawn curves, `towerLogic.js` stats and merge rules). Only `Renderer.js`, `audio.js`, and `storage.js` touch browser APIs. All balance numbers belong in `src/config/`.

## Build, Test, and Development Commands
Run `npm install` once. `npm run dev` starts Vite on `http://localhost:3000` (the `App` instance is exposed as `window.td` in dev). `npm run build` emits `dist/`, `npm run preview` serves it. `npm test` runs the `node:test` suites in `tests/`. `npm run sim -- <easy|normal|hard> <runs>` plays headless games with a greedy bot; re-run it after balance changes and report the average wave reached.

## Coding Style & Naming Conventions
ES modules, two-space indentation, semicolons, single quotes. Class files use PascalCase (`Game.js`), other modules camelCase. Keep data tables in `src/config/`, keep helpers pure, and keep UI text in Traditional Chinese. Wrap every `localStorage` access in try/catch (see `storage.js`).

## Testing Guidelines
Add `node:test` cases for deterministic logic (maps, merges, waves, save/load). For UI changes, run `npm run dev`, exercise building, upgrading, merging (button and drag), a map change at wave 20, and check the console for errors.

## Commit & Pull Request Guidelines
Write commits in the imperative mood and keep related work together. Pull requests should summarise the change, list manual test steps, include `npm run sim` results for balance changes, and attach screenshots when visuals change.
