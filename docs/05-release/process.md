# Level 05 — Release Process

## Versioning
- Semantic Versioning (`MAJOR.MINOR.PATCH`).
- Automated dependency validation via Dependabot.

## Continuous Integration (CI)
GitHub Actions workflow `.github/workflows/ci.yml` validates every pull request:
1. `pnpm lint` (Biome check)
2. `pnpm typecheck` (`tsc --noEmit`)
3. `pnpm test` (Vitest test suite)
4. `pnpm build` (Compile TypeScript output)
