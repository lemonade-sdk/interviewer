# Prompt & Interview Testing Tools

These tools allow you to **test the interview conversational flow and persona generation WITHOUT running the full Electron app**.

## Quick Start

```bash
# Run all prompt tests
npm run test:prompts

# Test with natural language prompts (prompt2.json)
npm run test:prompts:natural

# Generate a test persona
npm run test:persona -- --job examples/job.txt --resume examples/resume.txt

# Compare prompts.json vs prompt2.json
npm run test:compare
```

---

## Tools Overview

### 1. `prompt-test-harness.ts` — Comprehensive Test Suite

Tests the prompts in isolation, validating:
- JSON structure and validity
- 5-phase interview arc definition
- Persona generation flow
- Interview system prompt structure
- Conversation flow simulation

**Usage:**
```bash
# Basic test
npx ts-node src/test/prompt-test-harness.ts

# With natural language prompts
npx ts-node src/test/prompt-test-harness.ts --natural

# Verbose output
npx ts-node src/test/prompt-test-harness.ts --verbose

# Show help
npx ts-node src/test/prompt-test-harness.ts --help
```

**What it tests:**
1. ✓ Prompt JSON validity
2. ✓ Persona generation structure (19 fields, 5 phases)
3. ✓ Mock persona generation (simulated LLM call)
4. ✓ Interview system prompt structure
5. ✓ Conversation flow simulation (3-exchange test)
6. ✓ Natural language clarity (if using prompt2.json)

---

### 2. `test-persona.js` — Quick Persona Generator

Generates a sample persona from job description + resume WITHOUT needing:
- Electron app running
- Lemonade Server (uses mock responses)
- Full UI

**Usage:**
```bash
# With files
node src/test/test-persona.js --job ./examples/stripe-job.txt --resume ./examples/john-resume.txt

# With natural language prompts
node src/test/test-persona.js --job job.txt --resume resume.txt --natural

# Pretty print output
node src/test/test-persona.js --job job.txt --resume resume.txt --output pretty

# Minimal output
node src/test/test-persona.js --job job.txt --resume resume.txt --output minimal

# Use example data (no files needed)
node src/test/test-persona.js --example

# Show help
node src/test/test-persona.js --help
```

**Outputs:**
- Generated persona (name, role, style, difficulty)
- 5-phase interview arc (q1Topic-q5Topic)
- Validation targets
- Behavioral signals
- Job and resume analysis summaries

---

### 3. `compare-prompts.js` — Side-by-Side Comparison

Compares `prompts.json` (UCL/coded) vs `prompt2.json` (natural language):
- File size and structure
- Feature parity (19 fields, 5 phases, adaptive follow-ups)
- Syntax differences
- Recommendations

**Usage:**
```bash
npm run test:compare
# or
node src/test/compare-prompts.js
```

---

## Why These Tools?

| Problem | Solution |
|---------|----------|
| "I want to test persona generation without starting the Electron app" | `test-persona.js` — standalone CLI |
| "I want to verify the 5-phase flow works correctly" | `prompt-test-harness.ts` — automated tests |
| "I want to compare UCL vs natural language prompts" | `compare-prompts.js` — side-by-side analysis |
| "I need to debug why personas aren't generating correctly" | All tools show full prompt output |
| "I want to iterate on prompts quickly" | No app restart needed — just re-run tests |

---

## Testing Without the App

### Scenario 1: Testing Persona Generation

```bash
# 1. Create test files
echo "Senior Engineer at Google..." > test-job.txt
echo "Jane Doe - 5 years at Meta..." > test-resume.txt

# 2. Generate persona
node src/test/test-persona.js --job test-job.txt --resume test-resume.txt --output pretty

# 3. Review the 5-phase interview arc in the output
# 4. Adjust prompts if needed
# 5. Re-run test
```

### Scenario 2: Validating Prompt Changes

```bash
# 1. Edit prompts.json or prompt2.json

# 2. Run validation tests
npm run test:prompts

# 3. Check all tests pass
# 4. Compare with original
npm run test:compare
```

### Scenario 3: Debugging Conversation Flow

```bash
# 1. Run comprehensive test suite
npx ts-node src/test/prompt-test-harness.ts --verbose

# 2. Check "Conversation Flow Simulation" test
# 3. Review the mock interview exchanges
# 4. Identify where flow breaks
```

---

## Output Examples

### test-persona.js (Pretty Output)

```
🎭 Persona: Sarah Chen
   Engineering Manager at Stripe, 8 years building payment systems
   Style: challenging | Difficulty: medium | Gender: female

🎯 Primary Focus: Frontend architecture and technical leadership

📋 Must Cover Topics:
   1. TypeScript and large-scale component architecture
   2. Performance optimization for high-traffic applications
   3. Technical mentorship and team leadership

═══════════════════════════════════════════════════════════════
                    5-PHASE INTERVIEW ARC
═══════════════════════════════════════════════════════════════

Phase 1 — Warm-up / Baseline:
   Tell me about your background and what drew you to frontend 
   infrastructure roles at companies like Stripe. This is a baseline 
   question — calibrate your follow-up depth based on how clearly 
   they communicate their experience...

Phase 2 — Core Technical:
   Describe your TypeScript migration initiative. What was the scale? 
   What architectural decisions did you make? [Probe 2-4 times]...

[... Phases 3-5 ...]
```

### compare-prompts.js

```
FILE STATISTICS:
────────────────────────────────────────────────────────────────
                    prompts.json      prompt2.json
                    (UCL/coded)       (natural language)
────────────────────────────────────────────────────────────────
Persona Prompt:      2847 chars         3847 chars
Interview Prompt:    5842 chars         7241 chars

CONTENT ANALYSIS:
────────────────────────────────────────────────────────────────
Feature                           prompts.json    prompt2.json
────────────────────────────────────────────────────────────────
19-Field Structure                ✓ Yes           ✓ Yes
5-Phase Interview Arc             ✓ Yes           ✓ Yes
Adaptive Follow-ups               ✓ Yes           ✓ Yes
Duration Guidance                 ✗ No            ✓ Yes
Examples Provided                 ✗ No            ✓ Yes
Plain English (No UCL)            ✗ No            ✓ Yes
```

---

## Environment Variables

```bash
# Lemonade Server (for live testing - optional)
export LEMONADE_SERVER_URL=http://localhost:8000
export LEMONADE_MODEL=Qwen2.5-7B-Instruct

# Run tests
npm run test:prompts
```

Without these, tests use mock responses (faster, no server needed).

---

## Files Generated

| Tool | Creates Files? | Description |
|------|-----------------|-------------|
| `prompt-test-harness.ts` | No | Console output only |
| `test-persona.js` | No | Console output only |
| `compare-prompts.js` | No | Console output only |

All tools are **read-only** — they don't modify your prompts or data.

---

## Integration with CI/CD

Add to your GitHub Actions or CI:

```yaml
- name: Test Prompts
  run: |
    npm run test:prompts
    npm run test:compare
```

This ensures prompt changes don't break the interview flow.

---

## Troubleshooting

### "Command not found"
```bash
# Make sure ts-node is installed
npm install

# Or run with npx
npx ts-node src/test/prompt-test-harness.ts
```

### "Cannot find module"
```bash
# Run from project root
cd /path/to/interviewer
npm run test:prompts
```

### "Prompt file not found"
```bash
# Check files exist
ls src/data/prompts.json
ls src/data/prompt2.json

# If missing, copy from docs or regenerate
```

---

## Next Steps

1. **Test your current prompts:**
   ```bash
   npm run test:prompts
   ```

2. **Generate a sample persona:**
   ```bash
   npm run test:persona -- --example
   ```

3. **Compare both prompt versions:**
   ```bash
   npm run test:compare
   ```

4. **Choose your preferred prompt style** (UCL vs natural language)

5. **Iterate and test** without restarting the Electron app!
