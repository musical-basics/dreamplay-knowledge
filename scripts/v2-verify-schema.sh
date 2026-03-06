#!/bin/bash
# ============================================================
# V2 Schema Verification Script
# Connects to Supabase via psql and verifies the v2_ai_schema
# is correctly provisioned and isolated from public.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
#   bash scripts/v2-verify-schema.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo -e "${RED}ERROR: SUPABASE_DB_URL environment variable is not set.${NC}"
  echo "Usage: SUPABASE_DB_URL=\"postgresql://...\" bash scripts/v2-verify-schema.sh"
  exit 1
fi

PASS=0
FAIL=0

check() {
  local description="$1"
  local query="$2"
  local expected="$3"

  result=$(psql "$SUPABASE_DB_URL" -t -A -c "$query" 2>/dev/null || echo "ERROR")

  if [ "$result" = "$expected" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $description"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $description"
    echo "  Expected: '$expected'"
    echo "  Got:      '$result'"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  V2 Schema Verification"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── Check 1: Schema exists ────────────────────────────────
check "v2_ai_schema exists" \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'v2_ai_schema';" \
  "v2_ai_schema"

# ─── Check 2: All expected tables exist ─────────────────────
EXPECTED_TABLES=("documents" "embeddings" "checkpoint_migrations" "checkpoints" "checkpoint_blobs" "checkpoint_writes")

for table in "${EXPECTED_TABLES[@]}"; do
  check "Table v2_ai_schema.$table exists" \
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'v2_ai_schema' AND table_name = '$table';" \
    "$table"
done

# ─── Check 3: No LangGraph/vector tables leaked into public ─
FORBIDDEN_TABLES=("checkpoint_migrations" "checkpoints" "checkpoint_blobs" "checkpoint_writes" "embeddings")

for table in "${FORBIDDEN_TABLES[@]}"; do
  result=$(psql "$SUPABASE_DB_URL" -t -A -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" 2>/dev/null)
  if [ "$result" = "0" ]; then
    echo -e "${GREEN}✓ PASS${NC}: No '$table' in public schema"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: DANGER — '$table' found in public schema!"
    FAIL=$((FAIL + 1))
  fi
done

# ─── Check 4: RLS is enabled on all v2 tables ──────────────
for table in "${EXPECTED_TABLES[@]}"; do
  check "RLS enabled on v2_ai_schema.$table" \
    "SELECT rowsecurity FROM pg_tables WHERE schemaname = 'v2_ai_schema' AND tablename = '$table';" \
    "t"
done

# ─── Check 5: LangGraph migration seeds present ────────────
check "LangGraph migration seeds (v0-v4) present" \
  "SELECT COUNT(*) FROM v2_ai_schema.checkpoint_migrations;" \
  "5"

# ─── Check 6: Vector extension exists ──────────────────────
check "pgvector extension enabled" \
  "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" \
  "1"

# ─── Summary ───────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL $PASS CHECKS PASSED${NC}"
else
  echo -e "  ${GREEN}$PASS passed${NC}, ${RED}$FAIL FAILED${NC}"
fi
echo "═══════════════════════════════════════════════════════"
echo ""

exit $FAIL
