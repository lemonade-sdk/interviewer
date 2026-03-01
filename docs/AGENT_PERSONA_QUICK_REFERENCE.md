# Agent Persona — Quick Reference

## One-Page Summary for Teams

---

## What Is It?

An **Agent Persona** is a custom AI interviewer character created for each job interview.

**Not Generic:** "Sarah Chen, Engineering Manager at Stripe"  
**Not Random:** Asks questions about payment systems, not generic coding questions  
**Not Robotic:** Has personality (conversational, challenging, supportive, or formal)

---

## The 3-Step Generation Process

| Step | Status Message | Duration | What Happens |
|------|----------------|----------|--------------|
| 1 | "Reading job description" | 1-3 sec | AI understands role requirements |
| 2 | "Analyzing your resume" | 1-3 sec | AI maps your experience to the job |
| 3 | "Crafting interviewer persona" | 3-8 sec | AI creates name, personality, 5-phase arc |

**Total:** 5-15 seconds before interview starts

---

## What's Created (19 Fields)

### Identity
- `name`: "Sarah Chen"
- `personaRole`: "Engineering Manager at Stripe, 8 years"
- `gender`: female (for voice matching)

### Personality
- `interviewStyle`: conversational / formal / challenging / supportive
- `questionDifficulty`: easy / medium / hard

### The 5-Phase Interview Arc
| Phase | Topic Area | Typical Flow |
|-------|------------|--------------|
| **q1Topic** | Warm-up | Opening + baseline (1-2 exchanges) |
| **q2Topic** | Core Technical | Main assessment (1 + 2-4 follow-ups) |
| **q3Topic** | Behavioral | Leadership focus (1 STAR + 2-3 probes) |
| **q4Topic** | Resume Validation | Fact-checking (2-4 specific probes) |
| **q5Topic** | Deep Dive / Closing | Advanced scenario + wrap-up |

**Total:** 8-15 exchanges across 5 phases, not rigidly 5 questions.

### AI Guidance Fields
- `primaryProbeArea`: What to focus on
- `mustCoverTopic1-3`: Required topics from job description
- `validateClaim1-2`: Specific resume claims to challenge
- `watchSignal1-2`: Behavioral signals to observe

---

## Interview Styles Explained

| Style | Tone | Best For |
|-------|------|----------|
| 😊 **Conversational** | Friendly chat | Reducing anxiety, first practice |
| 👔 **Formal** | Professional, structured | Big companies (Google, banks) |
| 🔥 **Challenging** | Pushes back, deep follow-ups | Senior roles, stress practice |
| ⭐ **Supportive** | Encouraging, gentle | Beginners, confidence building |

---

## Difficulty Levels

| Level | Question Type | Follow-Up Aggression |
|-------|---------------|----------------------|
| 😊 **Easy** | Broad, foundational | Light |
| 🎯 **Medium** | Standard professional | Moderate |
| 🔥 **Hard** | Expert, ambiguous | Aggressive |

---

## Example Persona Output

**Input:** Senior Frontend at Stripe + Resume with React/TypeScript

**Output:**
```
Name: Sarah Chen
Role: Engineering Manager at Stripe, 8 years
Style: Challenging | Difficulty: Medium

**Phase 1 (Warm-up):** "Tell me about your background..."
→ *Baseline question + 1 follow-up if needed*

**Phase 2 (Core Technical):** "Describe your TypeScript migration. What were the challenges?"
→ *Main question + 2-4 follow-ups on architecture, metrics, trade-offs*

**Phase 3 (Behavioral):** "Tell me about advocating for quality when product wanted speed."
→ *STAR prompt + 2-3 probes on specific actions and outcomes*

**Phase 4 (Resume Validation):** "You mention leading a team of 5 — walk me through a decision."
→ *Fact-checking claim + probing depth of ownership*

**Phase 5 (Deep Dive):** "How would you design a dashboard for 10K TPS?"
→ *Complex scenario + candidate questions at end*

Validate: "Led team of 5" (probe leadership depth)
Validate: "40% performance improvement" (ask for specifics)
Watch: Ownership vs blame-shifting
Watch: Technical depth vs buzzwords
```

---

## Status Message Explanations

### "Reading job description"
**What:** AI extracts role requirements, skills, culture from job post  
**Duration:** 1-3 seconds  
**User sees:** Analysis appears when done (3-5 sentence summary)

---

### "Analyzing your resume"
**What:** AI matches your experience to job requirements, finds gaps/strengths  
**Duration:** 1-3 seconds  
**User sees:** Analysis appears when done (alignment assessment)

---

### "Crafting interviewer persona"
**What:** AI generates 19-field JSON persona with name, personality, 5-phase arc  
**Duration:** 3-8 seconds  
**User sees:** Persona card appears with name, role, style tags

---

## How Personas Change the Interview

| Without Persona | With Persona |
|-----------------|--------------|
| Generic "Tell me about yourself" | Specific "What drew you to payment systems?" |
| Random technical questions | Questions matching job requirements |
| Flat tone | Personality (challenging, supportive, etc.) |
| No resume awareness | Actively probes resume claims |
| One-size-fits-all | Tailored to company culture |

---

## Key Benefits

1. **Realism** — Practice with someone like your actual interviewer
2. **Relevance** — Questions match the specific job you're applying for
3. **Preparation** — AI validates your resume claims (catches exaggerations before real interview)
4. **Adaptability** — Style and difficulty match your comfort level
5. **Confidence** — Named persona feels more human than "AI Interviewer"

---

## FAQ

**Q: Why generate a new persona per job?**  
A: Each company/role is different. Stripe frontend ≠ Healthcare backend.

**Q: Can users edit personas?**  
A: Indirectly — change style/difficulty or re-upload documents to regenerate.

**Q: What if generation fails?**  
A: Falls back to generic persona — interview still works, just less tailored.

**Q: Why a 5-phase structure?**  
A: Fits 30 minutes with natural progression. Each phase: 1+ questions + adaptive follow-ups. Total: 8-15 exchanges.

**Q: Difference between style and difficulty?**  
A: Style = personality (nice vs tough). Difficulty = question complexity (easy vs hard).

---

## Technical Note

**Powered by:** Single LLM call with structured JSON output (19 fields)  
**Input:** Truncated job text (4000 chars) + resume text (4000 chars)  
**Output:** AgentPersona object → saved to database → linked to interview  
**Fallback:** Generic template if generation fails

---

## For Different Audiences

**Tell Product:** "Custom AI interviewers with 5-phase adaptive interview arcs tailored to each job — makes practice feel real."

**Tell Design:** "3-step visual flow with progress indicators, analysis summaries, and persona card reveal."

**Tell Engineering:** "Single LLM inference generates 19-field structured persona from documents. UCL injection into system prompt."

**Tell Leadership:** "Differentiator from generic tools — every interview is personalized to the company and role."

---

*Full details: AGENT_PERSONA_GUIDE.md*
