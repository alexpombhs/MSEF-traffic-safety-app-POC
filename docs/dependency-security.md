# Dependency security

Initial npm audit (November 1, 2026) identified 28 advisories across the monorepo, including a critical issue in MapLibre GL JS 5.x.

## Applied
- Updated web MapLibre dependency to `^6.16.0` to move outside the critical affected range reported by npm.
- Kept Expo SDK 54 and its React Native version aligned rather than using `npm audit fix --force`, which offered incompatible Expo 51 / React Native changes.

## Local verification required

```bash
npm install
npm run build:web
npm run typecheck
npm audit
npm audit --omit=dev
```

Commit the generated `package-lock.json` after a successful install and testing. This branch does not yet have a lockfile. Remaining advisories (e.g. `glob`, `minimatch`, `deepmerge`, `postcss`, `image-size`) require investigation against the installed dependency graph and compatible upstream releases; do not assume all are fixed by this update.

Security audits report vulnerable packages and dependency chains, not proof that an exploit is reachable in this application.
