# Evolu Migrations

## Goal

Keep Wealth Tracker's local-first data model evolvable without silently corrupting
or misreading old client data.

## Current policy

- Evolu is the source of truth for app data.
- Schema changes must be treated as product migrations, not just type edits.
- Net worth snapshots already carry an explicit schema marker via
  `NET_WORTH_SNAPSHOT_SCHEMA_VERSION` in [lib/evolu.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/evolu.ts).
- UI code may compare or aggregate only snapshot records it understands.

## Versioning rules

Use these rules for every Evolu-backed change:

1. Additive change:
   - Safe default: add a nullable field first.
   - Release readers before writers depend on the new field.

2. Breaking change:
   - Examples: rename a field, change units, change semantics, split one field into several.
   - Do not reuse the old field name with a new meaning.
   - Introduce a new field or table shape, then migrate reads/writes explicitly.

3. Snapshot change:
   - If `netWorthSnapshot` meaning changes, increment `NET_WORTH_SNAPSHOT_SCHEMA_VERSION`.
   - Dashboard and history code must reject comparisons across different versions.

4. Deletion:
   - Stop reading a field first.
   - Remove writes second.
   - Only then remove the schema field in a later pass.

## Recommended migration workflow

1. Define the schema change in [lib/evolu.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/evolu.ts).
2. Decide whether the change is additive or breaking.
3. If snapshots are affected, bump `NET_WORTH_SNAPSHOT_SCHEMA_VERSION`.
4. Update all readers to tolerate both old and new shapes during the transition.
5. Update writers after readers are compatible.
6. Add or update tests for old/new behavior.
7. Document the change in [CHANGELOG.md](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/CHANGELOG.md).

## Patterns to prefer

- Prefer new nullable fields over in-place semantic changes.
- Prefer explicit constants over magic version numbers.
- Prefer forward-compatible reads over one-shot assumptions.
- Prefer soft transitions over destructive schema rewrites.

## Patterns to avoid

- Reinterpreting an existing field without a version bump.
- Comparing snapshots with mixed schemas.
- Removing fields and readers in the same change without a compatibility window.
- Treating local persisted data as disposable unless the product explicitly says so.
