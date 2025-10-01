#!/bin/bash
# Test script untuk verifikasi superadmin setelah migration
# Usage: bash scripts/test_superadmin.sh

BASE_URL="http://localhost:4000/api/v1"
EMAIL="${SUPERADMIN_EMAIL:-superadmin@bukadita.com}"
PASSWORD="${SUPERADMIN_PASSWORD:-your_password_here}"

echo "=== Testing Superadmin Login ==="
echo ""

# 1. Login
echo "1. POST /auth/login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "$LOGIN_RESPONSE" | jq '.'

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.access_token // empty')
ROLE=$(echo "$LOGIN_RESPONSE" | jq -r '.data.user.profile.role // empty')

if [ -z "$TOKEN" ]; then
  echo ""
  echo "❌ Login failed! Check email/password in .env"
  exit 1
fi

if [ "$ROLE" != "superadmin" ]; then
  echo ""
  echo "❌ Role is '$ROLE', expected 'superadmin'"
  echo "Migration mungkin belum dijalankan atau superadmin belum di-recreate"
  exit 1
fi

echo ""
echo "✅ Login successful! Role: $ROLE"
echo ""

# 2. Get users (admin endpoint)
echo "2. GET /admin/users"
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/users?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "$USERS_RESPONSE" | jq '.'

# Check if we got visibility_rules
CALLER_ROLE=$(echo "$USERS_RESPONSE" | jq -r '.visibility_rules.caller_role // empty')

if [ "$CALLER_ROLE" = "superadmin" ]; then
  echo ""
  echo "✅ Admin endpoint accessible! Caller role: $CALLER_ROLE"
else
  echo ""
  echo "❌ Unexpected visibility_rules. Caller role: $CALLER_ROLE"
  exit 1
fi

echo ""

# 3. Get dashboard stats
echo "3. GET /admin/dashboard/stats"
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATS_RESPONSE" | jq '.'

echo ""
echo "═══════════════════════════════════"
echo "✅ ALL TESTS PASSED!"
echo "Superadmin berhasil dibuat dengan role yang benar"
echo "═══════════════════════════════════"
