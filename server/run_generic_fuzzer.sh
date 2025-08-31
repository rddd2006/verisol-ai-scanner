#!/bin/bash
# server/run_generic_fuzzer.sh

TARGET_CONTRACT=$1
FUZZ_RUNS=256

# --- KEY CHANGE: Force change into the correct directory ---
cd ../fuzzing_engine

# Now run the forge command from inside the fuzzing_engine directory
FUZZ_OUTPUT=$(TARGET_CONTRACT=$TARGET_CONTRACT forge test --fuzz-runs $FUZZ_RUNS --match-contract GenericFuzzer)

if [ $? -eq 0 ]; then
  echo "{\"passed\": true, \"reason\": \"All generic invariants passed.\"}"
else
  FAILURE_REASON=$(echo "$FUZZ_OUTPUT" | grep "Failing tests:")
  echo "{\"passed\": false, \"reason\": \"Generic invariant violated. $FAILURE_REASON\"}"
fi