# Agent Persona — Complete Guide

## For Product, Design, Engineering, and Leadership Teams

---

## What Is an Agent Persona?

**Simple Definition:**  
An Agent Persona is a **custom AI interviewer character** created specifically for each job interview. It's not a generic bot — it's a tailored persona with a name, role, personality, and custom questions based on the job you're interviewing for.

**Real-World Analogy:**  
Think of it like casting an actor for a role. Instead of a random person asking generic questions, you get "Sarah Chen, Senior Engineering Manager at Stripe" who asks questions relevant to that specific position.

---

## Why Agent Personas Matter

| Without Personas | With Agent Personas |
|------------------|---------------------|
| Generic "AI Interviewer" | Named character ("Sarah Chen, Engineering Manager") |
| Same questions for every job | Questions tailored to specific role |
| Flat, robotic tone | Personality style (conversational, challenging, etc.) |
| Random difficulty | Matched to user preference (easy/medium/hard) |
| No context awareness | Knows company, role, your background |

**Key Benefit:** Users practice with an interviewer that feels like the *actual* person they'll meet — making practice more realistic and effective.

---

## The Persona Generation Process

When a user uploads documents, the app creates a persona through **3 explicit stages**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AGENT PERSONA CREATION PIPELINE                       │
└─────────────────────────────────────────────────────────────────────────┘

STEP 1: ANALYZE JOB DESCRIPTION
├── Status: "Reading job description"
├── Subtitle: "Understanding role requirements and expectations"
├── AI Action: LLM reads full job post text
├── Extracts: Skills, experience level, team structure, company culture
├── Output: Job analysis summary (3-5 sentences)
└── Duration: 1-3 seconds

STEP 2: ANALYZE RESUME  
├── Status: "Analyzing your resume"
├── Subtitle: "Mapping your experience to the role"
├── AI Action: LLM reads resume text
├── Extracts: Skills, projects, experience gaps, strengths vs job req
├── Output: Resume analysis summary (3-5 sentences)
└── Duration: 1-3 seconds

STEP 3: CRAFT PERSONA
├── Status: "Crafting interviewer persona"
├── Subtitle: "Building a tailored interviewer for this role"
├── AI Action: LLM generates structured persona JSON (19 fields)
├── Creates: Name, role, personality, 5-phase interview arc
├── Output: Complete AgentPersona object
└── Duration: 3-8 seconds
```

**Total Generation Time:** 5-15 seconds

---

## What's In a Persona? (The 19 Fields)

When the AI crafts a persona, it generates these fields:

### Identity Fields
| Field | Example | Purpose |
|-------|---------|---------|
| `name` | "Sarah Chen" | Humanizes the interviewer |
| `personaRole` | "Engineering Manager at Stripe, 8 years experience" | Establishes credibility |
| `description` | "Sarah Chen — Engineering Manager at Stripe" | Quick summary |
| `gender` | "female" | Matches TTS voice (optional) |

### Personality Fields
| Field | Example Options | Purpose |
|-------|-----------------|---------|
| `interviewStyle` | conversational, formal, challenging, supportive | Tone of interview |
| `questionDifficulty` | easy, medium, hard | Challenge level |

### Interview Arc Fields (The 5 Phases)
| Field | Purpose |
|-------|---------|
| `q1Topic` | **Phase 1: Warm-up** — Opening topic area (intro, baseline calibration) |
| `q2Topic` | **Phase 2: Core Technical** — Primary technical assessment area |
| `q3Topic` | **Phase 3: Behavioral** — Leadership & team dynamics focus area |
| `q4Topic` | **Phase 4: Resume Validation** — Fact-checking specific claims area |
| `q5Topic` | **Phase 5: Deep Dive / Closing** — Advanced expertise & wrap-up area |

**Note:** Each "phase" contains 1+ questions plus adaptive follow-ups. Total exchanges: 8-15.

### Guidance Fields (What AI Should Focus On)
| Field | Purpose |
|-------|---------|
| `primaryProbeArea` | Main area to assess (e.g., "Distributed systems design") |
| `mustCoverTopic1` | Required topic #1 (from job description) |
| `mustCoverTopic2` | Required topic #2 |
| `mustCoverTopic3` | Required topic #3 |
| `validateClaim1` | Specific resume claim to probe (e.g., "Led team of 10") |
| `validateClaim2` | Second resume claim to validate |
| `watchSignal1` | Behavioral signal to watch for |
| `watchSignal2` | Second behavioral signal |

---

## Example Generated Persona

**Input Documents:**
- Job: Senior Frontend Engineer at Stripe
- Resume: 5 years React, led migration to TypeScript

**Generated Persona:**
```json
{
  "name": "Sarah Chen",
  "personaRole": "Engineering Manager at Stripe, 8 years building payment systems",
  "interviewStyle": "challenging",
  "questionDifficulty": "medium",
  "gender": "female",
  
  "q1Topic": "Tell me about your background and what drew you to frontend infrastructure roles.",
  "q2Topic": "Describe a large-scale TypeScript migration you led. What were the technical challenges and how did you measure success?",
  "q3Topic": "Tell me about a time you had to advocate for technical quality when product wanted speed. What was your approach?",
  "q4Topic": "You mention leading a team of 5 during the migration — walk me through a specific decision you made and its outcome.",
  "q5Topic": "How would you design a real-time dashboard handling 10,000 transactions per second? Walk me through your architecture decisions.",
  
  "primaryProbeArea": "Frontend system design and technical leadership",
  "mustCoverTopic1": "TypeScript and large-scale JavaScript architecture",
  "mustCoverTopic2": "Performance optimization and real-time data",
  "mustCoverTopic3": "Technical advocacy and stakeholder management",
  "validateClaim1": "Led team of 5 during TypeScript migration — probe for actual leadership vs participation",
  "validateClaim2": "Improved performance by 40% — ask for specifics on metrics and measurement",
  "watchSignal1": "Level of ownership vs blame-shifting in team scenarios",
  "watchSignal2": "Depth of technical reasoning vs buzzword usage"
}
```

**Result:** The user gets interviewed by "Sarah Chen" who asks Stripe-relevant frontend questions, challenges them appropriately, and validates their actual resume claims.

---

## Status Messages Explained (Persona-Specific)

### "Reading job description"
**What it means:** AI is understanding the role you're interviewing for.

**What's happening:**
- Full job post text sent to LLM
- AI extracting: required skills, seniority level, team structure, culture
- This understanding shapes the entire persona

**Duration:** 1-3 seconds

**User sees:**
- Animated step indicator
- Subtitle: "Understanding role requirements and expectations"
- Analysis text appears when done (e.g., "This role requires deep React expertise and experience with payment systems...")

---

### "Analyzing your resume"
**What it means:** AI is mapping your background to the job requirements.

**What's happening:**
- Resume text sent to LLM
- AI identifying: relevant skills, experience gaps, projects, strengths
- Looking for alignment and mismatch between resume and job

**Duration:** 1-3 seconds

**User sees:**
- Animated step indicator
- Subtitle: "Mapping your experience to the role"
- Analysis appears when done (e.g., "Strong React experience aligns well; TypeScript migration experience is particularly relevant...")

---

### "Crafting interviewer persona"
**What it means:** AI is creating the custom interviewer character.

**What's happening:**
- Single LLM call generates 19-field JSON persona
- Combines job understanding + resume analysis + user preferences
- Creates name, role, personality, 5-phase interview arc

**Duration:** 3-8 seconds

**User sees:**
- Animated step indicator
- Subtitle: "Building a tailored interviewer for this role"
- **When complete:** Persona card displays with:
  - Name (e.g., "Sarah Chen")
  - Role (e.g., "Engineering Manager at Stripe...")
  - Style tags (e.g., "challenging", "medium")

---

### "Starting interview..."
**What it means:** Final setup before conversation begins.

**What's happening:**
- Interview session created in database
- Persona attached to interview
- Navigation to Interview page

**Duration:** < 1 second

---

## Interview Styles Explained

Users can select the persona's approach:

| Style | Tone | Best For |
|-------|------|----------|
| **Conversational** | Friendly, casual chat | First practice, reducing anxiety |
| **Formal** | Professional, structured | Big company interviews (Google, banks) |
| **Challenging** | Pushes back, deep follow-ups | Senior roles, stress practice |
| **Supportive** | Encouraging, gentle guidance | Beginners, confidence building |

**How it affects the persona:**
- Changes the system prompt tone
- Affects follow-up aggressiveness
- Modifies feedback language during interview

---

## Difficulty Levels Explained

| Level | Question Complexity | Follow-up Depth |
|-------|----------------------|-----------------|
| **Easy** | Broad, foundational | Light probing |
| **Medium** | Standard professional | Moderate challenge |
| **Hard** | Expert-level, ambiguous | Aggressive deep-dives |

**How it affects the persona:**
- Shapes question depth within each of the 5 phases
- Determines how hard the AI pushes on vague answers
- Impacts validation strictness

---

## Persona Selection UI

Users can view and select personas in the **PersonaSelector** component:

**Card Display:**
```
┌─────────────────────────────────────────┐
│ Sarah Chen              ⭐ Default     │
│ Engineering Manager at Stripe           │
│                                         │
│ "I focus on system design and          │
│  technical leadership..."               │
│                                         │
│ [conversational] [🔥 hard]             │
└─────────────────────────────────────────┘
```

**Visual Indicators:**
- ⭐ Default badge (pre-selected)
- Style icon (User/Star/TrendingUp/Zap)
- Difficulty emoji (😊 easy / 🎯 medium / 🔥 hard)
- Preview of persona's approach

---

## How Personas Are Used During Interview

The persona isn't just decoration — it actively shapes the conversation:

### 1. System Prompt Injection
The persona's 19 fields populate the LLM's system prompt via UCL (Universal Control Language):
```
[[SET: persona = "Sarah Chen, Engineering Manager at Stripe"]]
[[SET: q1Topic = "Tell me about your background..."]]
[[ENFORCE: Progress through the 5-phase interview arc sequence]]
[[VALIDATE: "Led team of 5" — reference this specific claim]]
```

### 2. Interview Phase Management
The AI progresses through the 5 phases: `q1Topic` (Warm-up) → `q2Topic` (Core Technical) → `q3Topic` (Behavioral) → `q4Topic` (Resume Validation) → `q5Topic` (Deep Dive/Closing). Within each phase, the AI asks the baseline question then adapts follow-ups based on answer quality.

### 3. Dynamic Adaptation
Based on `interviewStyle` and `questionDifficulty`:
- Challenging style = more aggressive follow-ups
- Hard difficulty = expects more technical depth

### 4. Resume Validation
The AI specifically probes `validateClaim1` and `validateClaim2` — e.g., "You mentioned leading a team of 10 — tell me about a conflict you resolved."

### 5. Behavioral Observation
The AI watches for `watchSignal1` and `watchSignal2` — e.g., "Watch for ownership vs blame-shifting."

---

## Technical Architecture

### Generation Flow
```
Job Text + Resume Text
         │
         ▼
┌─────────────────────┐
│ PersonaGenerator   │
│ Service            │
├─────────────────────┤
│ 1. Truncate docs   │
│    (4000 chars max) │
│ 2. Build UCL prompt │
│ 3. LLM.generate()  │
│ 4. Parse JSON      │
│ 5. Validate fields │
└──────────┬──────────┘
           │
           ▼
    AgentPersona object
           │
           ▼
    Saved to database
    Linked to interview
```

### Database Schema
```typescript
interface AgentPersona {
  id: string;                    // UUID
  name: string;                  // "Sarah Chen"
  personaRole: string;           // "Engineering Manager..."
  interviewStyle: 'conversational' | 'formal' | 'challenging' | 'supportive';
  questionDifficulty: 'easy' | 'medium' | 'hard';
  gender: 'male' | 'female' | 'neutral';
  
  // Interview arc
  q1Topic: string;               // Warm-up question
  q2Topic: string;               // Core technical
  q3Topic: string;               // Behavioral
  q4Topic: string;               // Resume validation
  q5Topic: string;               // Deep-dive
  
  // Guidance
  primaryProbeArea: string;
  mustCoverTopic1-3: string[];
  validateClaim1-2: string[];
  watchSignal1-2: string[];
  
  // Metadata
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Fallback Behavior

If persona generation fails (network, LLM error, bad JSON):

**System falls back to generic persona:**
- Name: "Interviewer"
- Role: "Hiring Manager at [Company]"
- Uses standard 5-phase template (not tailored)
- Still functional, just less personalized

**User sees:** Interview proceeds normally — they won't know persona generation failed unless they look closely.

---

## FAQ: Agent Personas

### Q: Can users create their own personas?
**A:** Currently no — personas are AI-generated from documents. Future: manual persona creation.

### Q: Can users edit a generated persona?
**A:** Not directly, but they can:
- Change interview style (conversational → challenging)
- Change difficulty (medium → hard)
- Re-upload documents to regenerate

### Q: Why a 5-phase structure? Why not 3 or 10 phases?
**A:** 5 phases fits the 30-minute interview target with natural progression:
- **Phase 1** Warm-up: 2-3 min (1-2 exchanges)
- **Phase 2** Core Technical: 5-7 min (1 main question + 2-4 follow-ups)
- **Phase 3** Behavioral: 5-7 min (1 STAR prompt + 2-3 probing exchanges)
- **Phase 4** Resume Validation: 5-7 min (2-4 specific claim probes)
- **Phase 5** Deep Dive / Closing: 5-7 min (1 complex scenario + candidate questions)

**Total exchanges:** 8-15 questions across 5 topic areas, not rigidly 5 single questions.

### Q: Can personas be reused across interviews?
**A:** Yes! Once created, personas are saved. If a user interviews for the same company/role again, they can select the existing persona.

### Q: Why generate a new persona for every job?
**A:** Because each job is different. A "Senior Frontend" role at Stripe needs different questions than at a healthcare startup. The persona adapts to:
- Company culture (Stripe vs. Bank of America)
- Role type (Frontend vs. Backend vs. ML)
- Seniority (Junior vs. Staff)
- Industry (fintech vs. healthcare vs. gaming)

### Q: What's the difference between interview style and difficulty?
**A:** 
- **Style** = Personality (nice vs. tough interviewer)
- **Difficulty** = Question complexity (easy vs. hard problems)

You can have a "challenging easy" (friendly but simple questions) or "formal hard" (robotic interviewer with expert questions).

---

## Summary for Leadership

**What:** AI-generated custom interviewers for every job application

**Why:** Makes practice realistic — users interview with someone who feels like their actual future interviewer

**How:** AI reads job post + resume → creates named persona with tailored 5-phase interview arc

**Time:** 5-15 seconds of generation before 30-minute interview

**Impact:** Higher engagement, better practice outcomes, differentiated from generic interview tools

---

## Related Documentation
- `STATUS_MESSAGES_QUICK_REFERENCE.md` — All status messages explained
- `UI_UX_PROCESS_SLIDES.md` — Full user journey
- `src/services/PersonaGeneratorService.ts` — Implementation details
- `src/types/index.ts` — AgentPersona interface definition
