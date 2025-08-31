#!/bin/bash
RPC_URL=$1
CONTRACT_ADDRESS=$2
DEPOSIT_SIGNATURE="deposit()"
WITHDRAW_SIGNATURE="withdraw(uint256)"
TEST_AMOUNT=1
cast send --fork-url $RPC_URL $CONTRACT_ADDRESS $DEPOSIT_SIGNATURE --value $TEST_AMOUNT > /dev/null 2>&1
if [ $? -eq 0 ]; then
  cast send --fork-url $RPC_URL $CONTRACT_ADDRESS $WITHDRAW_SIGNATURE $TEST_AMOUNT > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "{\"isHoneypot\": false, \"reason\": \"Deposit/withdraw simulation passed.\"}"
  else
    echo "{\"isHoneypot\": true, \"reason\": \"Withdrawal simulation failed.\"}"
  fi
else
    echo "{\"isHoneypot\": false, \"reason\": \"Standard deposit() not found.\"}"
fi