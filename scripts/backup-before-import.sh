#!/usr/bin/env bash
# Create a git tag + reminder for Supabase/pg_dump backup before historical import.
# Usage (from repo root):
#   ./scripts/backup-before-import.sh
#   ./scripts/backup-before-import.sh pre-historical-import-2026-05-21

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="${1:-pre-historical-import-$(date +%Y-%m-%d)}"
COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists — skip git tag"
else
  git tag -a "$TAG" -m "Backup point before historical import ($COMMIT)"
  echo "Created tag: $TAG @ $COMMIT"
  echo "Push tag: git push origin $TAG"
fi

IMPORT_DIR="$ROOT/Backup/imports/$(date +%Y-%m-%d)"
mkdir -p "$IMPORT_DIR"
echo ""
echo "Next (manual, outside repo):"
echo "  1. Supabase Dashboard → Database → Backups (or pg_dump)"
echo "  2. Copy new Excel export to: $IMPORT_DIR"
echo "  3. DEPLOY_ENV=production npm run export:db --prefix web -- --out=Backup/snapshots"
echo ""
