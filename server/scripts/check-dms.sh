#!/bin/bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

SUFFIX="$(date +%s)$$"
USER_A="httpa${SUFFIX}"
USER_B="httpb${SUFFIX}"
PASSWORD="TestPass123"

echo "Creating two test users..."

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

TOKEN_A=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token"])' "$TMP_DIR/a.json")
TOKEN_B=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token"])' "$TMP_DIR/b.json")

echo "PASS: Both users created"

echo
echo "Testing GET /api/dms..."

STATUS=$(curl -sS -o "$TMP_DIR/conversations.json" -w "%{http_code}" \
  "$BASE_URL/api/dms" \
  -H "Authorization: Bearer $TOKEN_A")

if [ "$STATUS" != "200" ]; then
  echo "FAIL: GET /api/dms returned HTTP $STATUS"
  cat "$TMP_DIR/conversations.json"
  exit 1
fi

python3 -c 'import json,sys; assert isinstance(json.load(open(sys.argv[1])), list)' "$TMP_DIR/conversations.json"

echo "PASS: GET /api/dms returned a JSON array"

echo
echo "Testing GET conversation messages..."

STATUS=$(curl -sS -o "$TMP_DIR/messages.json" -w "%{http_code}" \
  "$BASE_URL/api/dms/$USER_B/messages" \
  -H "Authorization: Bearer $TOKEN_A")

if [ "$STATUS" != "200" ]; then
  echo "FAIL: GET messages returned HTTP $STATUS"
  cat "$TMP_DIR/messages.json"
  exit 1
fi

python3 -c 'import json,sys; assert isinstance(json.load(open(sys.argv[1])), list)' "$TMP_DIR/messages.json"

echo "PASS: GET conversation messages returned a JSON array"

echo
echo "Testing POST mark-read..."

STATUS=$(curl -sS -o "$TMP_DIR/read.txt" -w "%{http_code}" \
  -X POST "$BASE_URL/api/dms/$USER_B/read" \
  -H "Authorization: Bearer $TOKEN_A")

if [ "$STATUS" != "204" ]; then
  echo "FAIL: POST mark-read returned HTTP $STATUS"
  cat "$TMP_DIR/read.txt"
  exit 1
fi

echo "PASS: POST mark-read returned HTTP 204"

echo
echo "Testing GET /api/stats/rooms..."

STATUS=$(curl -sS -o "$TMP_DIR/stats.json" -w "%{http_code}" \
  "$BASE_URL/api/stats/rooms" \
  -H "Authorization: Bearer $TOKEN_A")

if [ "$STATUS" != "200" ]; then
  echo "FAIL: GET stats returned HTTP $STATUS"
  cat "$TMP_DIR/stats.json"
  exit 1
fi

python3 -c 'import json,sys; assert isinstance(json.load(open(sys.argv[1])), list)' "$TMP_DIR/stats.json"

echo "PASS: GET stats returned a JSON array"

echo
echo "Testing authentication..."

STATUS=$(curl -sS -o "$TMP_DIR/unauthorized.json" -w "%{http_code}" \
  "$BASE_URL/api/dms")

if [ "$STATUS" != "401" ]; then
  echo "FAIL: Unauthenticated request returned HTTP $STATUS"
  cat "$TMP_DIR/unauthorized.json"
  exit 1
fi

echo "PASS: Unauthenticated request rejected with HTTP 401"

echo
echo "ALL HTTP TESTS PASSED!"
