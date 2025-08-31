#!/bin/bash
# server/run_ai_fuzzer.sh

TARGET_CONTRACT=$1
FUZZ_RUNS=256

# --- THE FIX IS HERE: changed --fuzzer-runs to --fuzz-runs ---
FUZZ_OUTPUT=$(TARGET_CONTRACT=$TARGET_CONTRACT forge test -C ../fuzzing_engine --match-path test/AIGeneratedFuzzer.t.sol --fuzz-runs $FUZZ_RUNS 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  printf '{"status": "success", "log": "AI-generated custom fuzz tests passed."}'
else
  LOG_JSON=$(echo "$FUZZ_OUTPUT" | jq -Rs .)
  printf '{"status": "failure", "log": %s}' "$LOG_JSON"
fi