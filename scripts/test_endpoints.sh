#!/usr/bin/env bash
# Simple smoke tests for Bukadita API v1
BASE_URL=${BASE_URL:-http://localhost:4000/api/v1}
EMAIL="testuser_$(date +%s)@example.com"
PASS="Password123"

set -euo pipefail

echo "[1] Register"
REGISTER_RESP=$(curl -s -X POST "$BASE_URL/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Tester\"}")
TOKEN=$(echo "$REGISTER_RESP" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4 || true)
if [ -z "$TOKEN" ]; then
  echo "Registration failed: $REGISTER_RESP"; exit 1; fi

echo "[2] Get my profile (expect maybe 200/202)";
PROFILE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/me")
echo "$PROFILE"

echo "[3] Update my profile";
UPD=$(curl -s -X PUT "$BASE_URL/me" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"phone":"081234567890"}')
echo "$UPD"

echo "[4] Public schedules list";
SCHED=$(curl -s "$BASE_URL/schedules")
echo "$SCHED" | head -c 500

echo "Done."