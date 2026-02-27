#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Wealth Tracker — Release Script
#
# Usage:  npm run release
#   or:   ./scripts/release.sh [patch|minor|major]
#
# What it does:
#   1. Validates you're on develop and it's clean + up-to-date
#   2. Bumps version in package.json (patch / minor / major)
#   3. Updates CHANGELOG.md — moves [Unreleased] → [vX.Y.Z]
#   4. Commits the bump
#   5. Creates release/vX.Y.Z branch
#   6. Pushes to origin
#   7. Prints next steps (open PR to staging)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*"; exit 1; }

# ── Prereqs ───────────────────────────────────────────────────────────────────
command -v node  >/dev/null 2>&1 || error "node is required"
command -v git   >/dev/null 2>&1 || error "git is required"
command -v gh    >/dev/null 2>&1 || warn "gh CLI not found — you'll need to open PRs manually"

# ── Validate branch ───────────────────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "develop" ]]; then
  error "Must be on 'develop' branch (currently on '$CURRENT_BRANCH')"
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  error "You have uncommitted changes. Commit or stash them first."
fi

# Sync with remote
info "Syncing develop with origin..."
git pull origin develop --ff-only

# ── Determine bump type ───────────────────────────────────────────────────────
BUMP_TYPE="${1:-}"

if [[ -z "$BUMP_TYPE" ]]; then
  echo ""
  echo "What kind of release is this?"
  echo "  1) patch  — bug fixes (0.1.0 → 0.1.1)"
  echo "  2) minor  — new features (0.1.0 → 0.2.0)"
  echo "  3) major  — breaking / milestone (0.1.0 → 1.0.0)"
  echo ""
  read -rp "Enter choice [1/2/3] or version like '1.2.3': " CHOICE

  case "$CHOICE" in
    1|patch) BUMP_TYPE="patch" ;;
    2|minor) BUMP_TYPE="minor" ;;
    3|major) BUMP_TYPE="major" ;;
    *)
      # Allow direct version input like "1.2.3"
      if [[ "$CHOICE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        NEW_VERSION="$CHOICE"
        BUMP_TYPE="custom"
      else
        error "Invalid choice: $CHOICE"
      fi
      ;;
  esac
fi

# ── Compute new version ───────────────────────────────────────────────────────
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Current version: v$CURRENT_VERSION"

if [[ "$BUMP_TYPE" != "custom" ]]; then
  NEW_VERSION=$(node -e "
    const [major, minor, patch] = '$CURRENT_VERSION'.split('.').map(Number);
    if ('$BUMP_TYPE' === 'major') console.log((major+1) + '.0.0');
    else if ('$BUMP_TYPE' === 'minor') console.log(major + '.' + (minor+1) + '.0');
    else console.log(major + '.' + minor + '.' + (patch+1));
  ")
fi

echo ""
warn "About to release: v$CURRENT_VERSION → v$NEW_VERSION"
read -rp "Continue? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

RELEASE_BRANCH="release/v$NEW_VERSION"
TODAY=$(date +%Y-%m-%d)

# ── Bump package.json ─────────────────────────────────────────────────────────
info "Bumping package.json to v$NEW_VERSION..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
success "package.json updated"

# ── Update CHANGELOG.md ───────────────────────────────────────────────────────
info "Updating CHANGELOG.md..."

if ! grep -q "\[Unreleased\]" CHANGELOG.md; then
  warn "No [Unreleased] section found in CHANGELOG.md — skipping changelog update"
else
  # Replace ## [Unreleased] with ## [vX.Y.Z] — DATE  and add new [Unreleased] above
  node -e "
    const fs = require('fs');
    let content = fs.readFileSync('CHANGELOG.md', 'utf8');

    // Add new empty [Unreleased] section above the current one
    const newUnreleased = \`## [Unreleased]

### Added

### Changed

### Fixed

---

\`;
    content = content.replace(
      '## [Unreleased]',
      newUnreleased + '## [v$NEW_VERSION] — $TODAY'
    );

    // Update comparison links at the bottom
    content = content.replace(
      /\[Unreleased\]: (.+)compare\/(.+)\.\.\.HEAD/,
      \`[Unreleased]: https://github.com/MiroslavProchazka/wealth-tracker/compare/v$NEW_VERSION...HEAD\n[v$NEW_VERSION]: https://github.com/MiroslavProchazka/wealth-tracker/compare/\$2...v$NEW_VERSION\`
    );

    fs.writeFileSync('CHANGELOG.md', content);
  "
  success "CHANGELOG.md updated"
fi

# ── Create release branch & commit ───────────────────────────────────────────
info "Creating release branch '$RELEASE_BRANCH'..."
git checkout -b "$RELEASE_BRANCH"

git add package.json CHANGELOG.md
git commit -m "chore(release): v$NEW_VERSION"

info "Pushing '$RELEASE_BRANCH' to origin..."
git push origin "$RELEASE_BRANCH"

success "Release branch pushed!"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Release v$NEW_VERSION ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Review & update CHANGELOG.md if needed"
echo "  2. Open PR:  release/v$NEW_VERSION → staging"
echo "     ${BLUE}https://github.com/MiroslavProchazka/wealth-tracker/compare/staging...release/v$NEW_VERSION${NC}"
echo ""
echo "  3. After staging tests pass, open PR:  staging → main"
echo "  4. After merge to main → tag the release on GitHub:"
echo "     ${BLUE}https://github.com/MiroslavProchazka/wealth-tracker/releases/new?tag=v$NEW_VERSION${NC}"
echo ""

# Auto-open PR if gh is available
if command -v gh >/dev/null 2>&1; then
  read -rp "Open PR to staging now with gh CLI? [y/N] " OPEN_PR
  if [[ "$OPEN_PR" =~ ^[Yy]$ ]]; then
    gh pr create \
      --base staging \
      --head "$RELEASE_BRANCH" \
      --title "release: v$NEW_VERSION" \
      --body "$(cat <<EOF
## Release v$NEW_VERSION

See [CHANGELOG.md](../blob/$RELEASE_BRANCH/CHANGELOG.md) for full list of changes.

## Checklist
- [ ] CHANGELOG.md reviewed and complete
- [ ] Tested locally
- [ ] Ready for staging deploy
EOF
)"
    success "PR opened!"
  fi
fi
