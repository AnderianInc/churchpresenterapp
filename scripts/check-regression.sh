#!/usr/bin/env bash
# scripts/check-regression.sh
#
# Compares test results between the current branch and main, reporting any
# regressions (tests that passed on main but now fail) or new coverage (tests
# that pass on the current branch but did not exist on main).
#
# Usage:
#   bash scripts/check-regression.sh
#
# Prerequisites: npm is on the PATH and `npm test` works in the repo root.
# No jq dependency — all parsing uses grep/awk/sed on npm test output.

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

MAIN_BRANCH="main"
TMP_DIR="$(mktemp -d)"
CURRENT_RESULTS="$TMP_DIR/current.txt"
MAIN_RESULTS="$TMP_DIR/main.txt"
# Set by run_tests; read by parse_results.
LAST_TEST_OUTPUT=""

# ── Helpers ───────────────────────────────────────────────────────────────────

header() {
  echo ""
  echo "========================================================"
  echo "  $*"
  echo "========================================================"
  echo ""
}

# run_tests LABEL OUTPUT_FILE
# Runs the full test suite with watchAll=false, tee-ing output to OUTPUT_FILE.
# Captures both stdout and stderr so the summary line is always included.
# Does NOT exit on test failure (we want to compare counts, not abort).
run_tests() {
  local label="$1"
  local output_file="$2"

  echo "▶ Running tests on: $label"
  echo ""

  # react-scripts test writes the summary to stderr in some environments;
  # merge both streams and capture.  Suppress the JSON flag entirely — we
  # parse the human-readable summary line instead (more robust).
  set +e
  npm test -- --watchAll=false --forceExit 2>&1 | tee "$output_file"
  set -e

  echo ""
}

# parse_results OUTPUT_FILE
# Reads the "Tests: X passed, Y failed, Z total" summary line from the
# captured test output.  Sets PARSED_PASSED and PARSED_FAILED in the caller's
# environment.
parse_results() {
  local output_file="$1"

  # react-scripts / Jest prints a line like:
  #   Tests:       5 failed, 42 passed, 47 total
  # or:
  #   Tests:       42 passed, 42 total
  # Field order can vary; use grep+awk to extract each number independently.

  local summary_line
  summary_line="$(grep -E '^Tests:' "$output_file" | tail -1 || true)"

  if [ -z "$summary_line" ]; then
    # Fallback: look for "X passed" anywhere in the output
    summary_line="$(grep -E '[0-9]+ passed' "$output_file" | tail -1 || true)"
  fi

  # Extract "passed" count
  PARSED_PASSED="$(echo "$summary_line" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo 0)"
  # Extract "failed" count (may be absent when all tests pass)
  PARSED_FAILED="$(echo "$summary_line" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' || echo 0)"

  # Default to 0 if extraction failed
  PARSED_PASSED="${PARSED_PASSED:-0}"
  PARSED_FAILED="${PARSED_FAILED:-0}"
}

# ── Main script ───────────────────────────────────────────────────────────────

header "Church Presenter — Regression Check"

# 1. Save the current branch name.
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Current branch : $CURRENT_BRANCH"
echo "Baseline branch: $MAIN_BRANCH"
echo ""

if [ "$CURRENT_BRANCH" = "$MAIN_BRANCH" ]; then
  echo "⚠  Already on $MAIN_BRANCH — nothing to compare against."
  echo "   Check out a feature branch and re-run."
  exit 0
fi

# 2. Run tests on the CURRENT branch.
header "Step 1/3 — Testing current branch ($CURRENT_BRANCH)"
run_tests "$CURRENT_BRANCH" "$CURRENT_RESULTS"

parse_results "$CURRENT_RESULTS"
CURRENT_PASSED="$PARSED_PASSED"
CURRENT_FAILED="$PARSED_FAILED"

echo "  → passed: $CURRENT_PASSED  failed: $CURRENT_FAILED"

# 3. Stash any uncommitted changes so we can check out main cleanly.
header "Step 2/3 — Switching to $MAIN_BRANCH"

STASH_NEEDED=false
# Check for uncommitted changes (staged or unstaged, excluding untracked files).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Stashing uncommitted changes..."
  git stash push -m "check-regression.sh temporary stash"
  STASH_NEEDED=true
else
  echo "Working tree is clean — no stash needed."
fi

# Switch to main and run tests.
git checkout "$MAIN_BRANCH"
echo ""

run_tests "$MAIN_BRANCH" "$MAIN_RESULTS"

parse_results "$MAIN_RESULTS"
MAIN_PASSED="$PARSED_PASSED"
MAIN_FAILED="$PARSED_FAILED"

echo "  → passed: $MAIN_PASSED  failed: $MAIN_FAILED"

# 4. Restore: return to the original branch and pop stash if applicable.
header "Step 3/3 — Restoring branch ($CURRENT_BRANCH)"

git checkout "$CURRENT_BRANCH"

if [ "$STASH_NEEDED" = true ]; then
  echo "Restoring stashed changes..."
  git stash pop
else
  echo "No stash to restore."
fi

# 5. Print comparison table.
header "Results Comparison"

printf "%-28s %-14s %-12s\n" "Branch" "Tests Passed" "Tests Failed"
printf "%-28s %-14s %-12s\n" "----------------------------" "--------------" "------------"
printf "%-28s %-14s %-12s\n" "$MAIN_BRANCH (baseline)" "$MAIN_PASSED" "$MAIN_FAILED"
printf "%-28s %-14s %-12s\n" "$CURRENT_BRANCH" "$CURRENT_PASSED" "$CURRENT_FAILED"
echo ""

# 6. Regression / improvement analysis.
EXIT_CODE=0

if [ "$CURRENT_FAILED" -gt 0 ]; then
  # Tests are failing on the current branch.
  # A regression occurred if main had fewer (or zero) failures.
  if [ "$CURRENT_FAILED" -gt "$MAIN_FAILED" ]; then
    REGRESSION_COUNT=$(( CURRENT_FAILED - MAIN_FAILED ))
    echo "❌  REGRESSION DETECTED: $REGRESSION_COUNT test(s) that passed on $MAIN_BRANCH"
    echo "    now fail on $CURRENT_BRANCH."
    EXIT_CODE=1
  else
    echo "⚠   $CURRENT_FAILED test(s) are failing on $CURRENT_BRANCH, but $MAIN_BRANCH"
    echo "    also had $MAIN_FAILED failure(s) — no new regressions introduced."
  fi
else
  echo "✅  No test failures on $CURRENT_BRANCH."
fi

# 7. Note new coverage (more passing tests than main).
if [ "$CURRENT_PASSED" -gt "$MAIN_PASSED" ]; then
  NEW_TESTS=$(( CURRENT_PASSED - MAIN_PASSED ))
  echo "🆕  $NEW_TESTS new passing test(s) on $CURRENT_BRANCH vs $MAIN_BRANCH."
elif [ "$CURRENT_PASSED" -lt "$MAIN_PASSED" ]; then
  LOST=$(( MAIN_PASSED - CURRENT_PASSED ))
  echo "⚠   $LOST fewer passing test(s) on $CURRENT_BRANCH than on $MAIN_BRANCH."
else
  echo "ℹ   Same number of passing tests on both branches ($CURRENT_PASSED)."
fi

# 8. Clean up temp directory.
rm -rf "$TMP_DIR"

echo ""
exit "$EXIT_CODE"
