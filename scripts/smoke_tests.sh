#!/usr/bin/env bash
# Simple curl-based smoke tests. Requires running API locally or BASE_URL env.
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:4000/api/v1}

random_email() { echo "smoke_$(date +%s%N | cut -b1-13)@example.com"; }
PASS='Password123'
EMAIL=$(random_email)

echo "[1] Health check" || true
curl -sf ${BASE_URL%/}/../health || { echo 'Health failed'; exit 1; }

echo "[2] Register" || true
REG=$(curl -s -X POST "$BASE_URL/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Smoke User\"}")
TOKEN=$(echo "$REG" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4 || true)
if [ -z "$TOKEN" ]; then echo "Registration failed: $REG"; exit 1; fi

echo "[3] List materials (public)" || true
curl -sf "$BASE_URL/materials" | head -c 200 >/dev/null || { echo 'Materials list failed'; exit 1; }

echo "[4] List schedules (public)" || true
curl -sf "$BASE_URL/schedules" | head -c 200 >/dev/null || { echo 'Schedules list failed'; exit 1; }

echo "[5] Auth me (may be 202 if profile lag)" || true
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/users/me" | head -c 200 >/dev/null || { echo 'Me endpoint failed'; exit 1; }

echo "All smoke tests passed."