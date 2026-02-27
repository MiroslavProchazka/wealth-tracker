# Contributing to Wealth Tracker

## Branch Strategy

```
feature/xxx  ──►  develop  ──►  staging  ──►  main
                   (CI)       (staging       (production
                              deploy)         deploy)
```

| Branch | Purpose | Deploys to |
|--------|---------|-----------|
| `main` | Production — stable, released code | Vercel Production |
| `staging` | Pre-release testing | Vercel Staging (preview URL) |
| `develop` | Integration branch for features | — (CI checks only) |
| `feature/xxx` | Individual feature work | Vercel Preview (on PR) |
| `release/vX.Y.Z` | Release preparation | — |

---

## Development Workflow

### 1. Start a new feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

### 2. Work, commit, push

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(stocks): add dividend tracking
fix(crypto): handle rate limit gracefully
chore(deps): bump yahoo-finance2 to 3.14
```

### 3. Open PR → `develop`

- Fill in the PR template
- CI runs: TypeScript check, ESLint, build
- Get review → squash and merge

### 4. Release cycle

When `develop` has enough for a release:

```bash
npm run release          # bump version, update CHANGELOG, create release branch
```

This script:
1. Asks for the new version (`patch` / `minor` / `major`)
2. Updates `package.json` version
3. Updates `CHANGELOG.md` (moves `[Unreleased]` → `[vX.Y.Z]`)
4. Creates branch `release/vX.Y.Z`
5. Pushes it and opens a PR → `staging`

### 5. Test on staging

After merging `release/vX.Y.Z` → `staging`:
- Vercel staging deploy runs automatically
- Test the staging URL thoroughly

### 6. Ship to production

```bash
# After staging is green, open PR: staging → main
# Merge → production deploy runs automatically
# Tag the release on GitHub
```

---

## Setup for Vercel Deployment

Add these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Where to get it |
|--------|----------------|
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` |

### Vercel first-time setup

```bash
npm i -g vercel
vercel login
vercel link        # links repo, creates .vercel/project.json
vercel env pull    # pulls env vars to .env.local
```

Add `.vercel/` to `.gitignore` (already done).

---

## Versioning

`vMAJOR.MINOR.PATCH` — Semantic Versioning:

- **PATCH** `v0.1.1` — bug fixes, small improvements
- **MINOR** `v0.2.0` — new features, backwards compatible
- **MAJOR** `v1.0.0` — significant milestones or breaking changes
