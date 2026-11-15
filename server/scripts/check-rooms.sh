#!/bin/bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

extract_token() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token"])' "$1" 2>/dev/null || \
  grep -o '"token":"[^"]*"' "$1" | head -n1 | cut -d'"' -f4
}

SUFFIX="$(date +%s)$$"
USER_A="rmusera${SUFFIX}"
USER_B="rmuserb${SUFFIX}"
PASSWORD="TestPass123"

echo "Running Rooms REST API checks against $BASE_URL..."

# 1. GET /api/rooms without authentication returns 401
STATUS=$(curl -sS -o "$TMP_DIR/unauth.json" -w "%{http_code}" "$BASE_URL/api/rooms")
if [ "$STATUS" != "401" ]; then
  echo "FAIL: GET /api/rooms without auth returned HTTP $STATUS"
  cat "$TMP_DIR/unauth.json"
  exit 1
fi
echo "PASS: GET /api/rooms without authentication returns 401"

# 2. Create and authenticate test users
STATUS=$(curl -sS -o "$TMP_DIR/a.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_A\",\"password\":\"$PASSWORD\"}")

if [ "$STATUS" != "201" ]; then
  echo "FAIL: Signup A returned HTTP $STATUS"
  cat "$TMP_DIR/a.json"
  exit 1
fi

STATUS=$(curl -sS -o "$TMP_DIR/b.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_B\",\"password\":\"$PASSWORD\"}")

if [ "$STATUS" != "201" ]; then
  echo "FAIL: Signup B returned HTTP $STATUS"
  cat "$TMP_DIR/b.json"
  exit 1
fi

TOKEN_A=$(extract_token "$TMP_DIR/a.json")
TOKEN_B=$(extract_token "$TMP_DIR/b.json")

echo "PASS: Created and authenticated test users $USER_A and $USER_B"

# 3. GET /api/rooms with authentication returns 200
STATUS=$(curl -sS -o "$TMP_DIR/rooms.json" -w "%{http_code}" \
  "$BASE_URL/api/rooms" \
  -H "Authorization: Bearer $TOKEN_A")

if [ "$STATUS" != "200" ]; then
  echo "FAIL: GET /api/rooms returned HTTP $STATUS"
  cat "$TMP_DIR/rooms.json"
  exit 1
fi

if ! grep -q '"general"' "$TMP_DIR/rooms.json"; then
  echo "FAIL: Response does not include 'general' room"
  cat "$TMP_DIR/rooms.json"
  exit 1
fi

echo "PASS: GET /api/rooms with authentication returns 200"

# 4. GET /api/rooms/nosuchroom/messages returns 404
STATUS=$(curl -sS -o "$TMP_DIR/notfound.json" -w "%{http_code}" \
  "$BASE_URL/api/rooms/nosuchroom/messages" \
  -H "Authorization: Bearer $TOKEN_A")

if [ "$STATUS" != "404" ]; then
  echo "FAIL: GET /api/rooms/nosuchroom/messages returned HTTP $STATUS"
  cat "$TMP_DIR/notfound.json"
  exit 1
fi

echo "PASS: GET /api/rooms/nosuchroom/messages returns 404"

echo
echo "ALL ROOMS REST CHECKS PASSED!"
