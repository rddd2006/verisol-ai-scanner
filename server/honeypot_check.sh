#!/bin/bash
# VeriSol Honeypot Detection Script
# Simulates deposit/withdraw to detect if contract traps funds

RPC_URL=$1
CONTRACT_ADDRESS=$2

if [ -z "$RPC_URL" ] || [ -z "$CONTRACT_ADDRESS" ]; then
    echo "{\"isHoneypot\": false, \"reason\": \"Missing RPC URL or contract address\"}"
    exit 1
fi

# Function signatures
DEPOSIT_SIGNATURE="deposit()"
WITHDRAW_SIGNATURE="withdraw(uint256)"
TEST_AMOUNT="1"

# Try to call deposit() - use read-only call first
if cast call --rpc-url "$RPC_URL" "$CONTRACT_ADDRESS" "$DEPOSIT_SIGNATURE" > /dev/null 2>&1; then
    # If deposit is callable, try withdraw
    if cast call --rpc-url "$RPC_URL" "$CONTRACT_ADDRESS" "$WITHDRAW_SIGNATURE" "$TEST_AMOUNT" > /dev/null 2>&1; then
        echo "{\"isHoneypot\": false, \"reason\": \"Standard deposit/withdraw functions callable.\"}"
    else
        echo "{\"isHoneypot\": true, \"reason\": \"Deposit callable but withdraw failed - possible honeypot.\"}"
    fi
else
    # No standard deposit function - this is normal for most contracts
    echo "{\"isHoneypot\": false, \"reason\": \"Standard deposit() function not found - contract may use different interface.\"}"
fi