#!/bin/bash
# Test API endpoints to debug events issue
# Usage: ./test_api_endpoints.sh <access_token>

if [ -z "$1" ]; then
    echo "Usage: ./test_api_endpoints.sh <access_token>"
    echo "Get access_token from browser localStorage after logging in"
    exit 1
fi

TOKEN=$1
API_BASE=${API_BASE_URL:-"http://localhost:8000/api"}

echo "Testing API endpoints..."
echo "API Base: $API_BASE"
echo ""

echo "1. Testing /chapters endpoint..."
curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/chapters" | jq '.'
echo ""

echo "2. Getting chapter ID..."
CHAPTER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/chapters" | jq -r '.[0].id // empty')
if [ -z "$CHAPTER_ID" ]; then
    echo "ERROR: No chapter ID returned"
    exit 1
fi
echo "Chapter ID: $CHAPTER_ID"
echo ""

echo "3. Testing /events endpoint..."
curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/events?chapter_id=$CHAPTER_ID" | jq '.'
echo ""

echo "4. Testing /me endpoint (user profile)..."
curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/me" | jq '.'
echo ""
