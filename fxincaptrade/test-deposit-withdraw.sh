#!/bin/bash
# Test Deposit & Withdraw API Endpoints
# Usage: ./test-deposit-withdraw.sh YOUR_AUTH_TOKEN

if [ -z "$1" ]; then
  echo "Usage: $0 YOUR_AUTH_TOKEN"
  echo ""
  echo "To get your token:"
  echo "1. Open browser DevTools (F12)"
  echo "2. Go to Console tab"
  echo "3. Run: localStorage.getItem('auth_token')"
  exit 1
fi

TOKEN="$1"
API_BASE="https://api.fxincap.com"

echo "===== Testing SUIMFX API Endpoints ====="
echo ""

# Test 1: Health Check
echo "1. Testing Health Check..."
curl -s "${API_BASE}/api/ping" | jq .
echo ""

# Test 2: Get Fund Requests
echo "2. Testing Get Fund Requests..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/api/user/fund-requests" | jq .
echo ""

# Test 3: Get Beneficiaries
echo "3. Testing Get Beneficiaries..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/api/user/beneficiaries" | jq .
echo ""

# Test 4: Get User Balance (Demo)
echo "4. Testing Get Balance (Demo Mode)..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/api/user/balance?mode=demo" | jq .
echo ""

# Test 5: Get User Balance (Real)
echo "5. Testing Get Balance (Real Mode)..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/api/user/balance?mode=real" | jq .
echo ""

# Test 6: Get User Profile
echo "6. Testing Get User Profile..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/api/user/profile" | jq .
echo ""

echo "===== All Tests Complete ====="
echo ""
echo "Note: To test deposit with screenshot upload, use the browser UI at:"
echo "https://terminal.suimfx.world/wallet"
