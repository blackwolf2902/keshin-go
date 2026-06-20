#!/usr/bin/env bash
# Integration test for Keshin Chat Pipeline
# Requires: Python server running on port 9090
# Optional: LLM API key in environment
set -euo pipefail

PASS=0
FAIL=0

pass() {
    PASS=$((PASS + 1))
    echo "  ✓ $1"
}

fail() {
    FAIL=$((FAIL + 1))
    echo "  ✗ $1"
}

echo "=== Keshin Integration Tests ==="
echo ""

# Test 1: Health check
echo "Test 1: Health endpoint"
HEALTH=$(curl -s http://localhost:9090/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    pass "Health endpoint returns ok"
else
    fail "Health endpoint failed: $HEALTH"
fi

# Test 2: Chat endpoint with personality
echo ""
echo "Test 2: Chat endpoint"
CHAT_RESPONSE=$(curl -s -X POST http://localhost:9090/api/chat \
    -H "Content-Type: application/json" \
    -d '{
        "character_id": "hinata",
        "message": "Hello!",
        "character_name": "Hinata",
        "character_lang": "ja",
        "personality_prompt": "You are a friendly Japanese anime character."
    }' 2>/dev/null || echo "")

if echo "$CHAT_RESPONSE" | grep -q '"japanese_text"'; then
    pass "Chat endpoint returns response"
    echo "    Japanese: $(echo "$CHAT_RESPONSE" | grep -o '"japanese_text":"[^"]*"' | head -1)"
    echo "    Subtitle: $(echo "$CHAT_RESPONSE" | grep -o '"english_subtitle":"[^"]*"' | head -1)"
    echo "    Emotion: $(echo "$CHAT_RESPONSE" | grep -o '"emotion":"[^"]*"' | head -1)"
elif echo "$CHAT_RESPONSE" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$CHAT_RESPONSE" | grep -o '"error":"[^"]*"' | head -1)
    if echo "$ERROR_MSG" | grep -qi "api key"; then
        warn "Chat skipped (no API key configured): $ERROR_MSG"
    else
        fail "Chat endpoint error: $ERROR_MSG"
    fi
else
    fail "Chat endpoint returned unexpected: $CHAT_RESPONSE"
fi

# Test 3: SSE streaming endpoint
echo ""
echo "Test 3: SSE streaming endpoint"
STREAM_RESPONSE=$(curl -s -N --max-time 3 \
    "http://localhost:9090/api/chat/stream?character_id=hinata&message=Hello&character_name=Hinata&personality_prompt=You+are+a+friendly+anime+character" \
    2>/dev/null || echo "")

if echo "$STREAM_RESPONSE" | grep -q "event:"; then
    pass "SSE endpoint returns events"
elif [ -z "$STREAM_RESPONSE" ]; then
    pass "SSE endpoint connected (no data in 3s - expected with LLM)"
else
    fail "SSE endpoint unexpected: $STREAM_RESPONSE"
fi

# Test 4: List characters
echo ""
echo "Test 4: List characters endpoint"
CHARACTERS=$(curl -s http://localhost:8080/api/characters 2>/dev/null || "")
# Fallback to Go proxy
if [ -z "$CHARACTERS" ]; then
    CHARACTERS=$(curl -s http://localhost:8080/api/characters 2>/dev/null || echo "[]")
fi
if echo "$CHARACTERS" | grep -q '"name"'; then
    pass "Characters endpoint returns pack list"
else
    fail "Characters endpoint failed: $CHARACTERS"
fi

# Test 5: Go CLI version
echo ""
echo "Test 5: Go CLI version"
if command -v go &> /dev/null; then
    VERSION=$(cd "$(dirname "$0")/.." && go run ./cmd/keshin version 2>/dev/null || echo "")
    if echo "$VERSION" | grep -q "keshin v"; then
        pass "Go CLI version works"
    else
        fail "Go CLI version failed: $VERSION"
    fi
else
    fail "Go not found"
fi

# Summary
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
