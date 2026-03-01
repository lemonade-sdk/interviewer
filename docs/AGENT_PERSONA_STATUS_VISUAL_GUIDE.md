# Agent Persona — Status & Visual Guide

## How Persona Status Messages Map to UI

---

## The 3-Step Persona Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PREPARATION SCREEN                                   │
│                    (Right Panel — Persona Generation)                        │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: ANALYZE JOB
┌─────────────────────────────────────────┐
│  🔄 [spinner]                           │
│  Reading job description                │  ← Status Text
│  Understanding role requirements...     │  ← Subtitle
│                                         │
│  □ Analyzing your resume                 │  ← Pending (gray)
│  □ Crafting interviewer persona        │  ← Pending (gray)
└─────────────────────────────────────────┘

        ↓ (1-3 seconds)

STEP 2: ANALYZE RESUME  
┌─────────────────────────────────────────┐
│  ✅ [checkmark]                         │
│  Reading job description                │  ← Done (green)
│  [Analysis text appears]                │  
│  "This role requires React expertise    │
│   and payment systems experience..."    │
│                                         │
│  🔄 [spinner]                           │
│  Analyzing your resume                  │  ← Active (yellow)
│  Mapping your experience to the role...│  ← Subtitle
│                                         │
│  □ Crafting interviewer persona          │  ← Pending (gray)
└─────────────────────────────────────────┘

        ↓ (1-3 seconds)

STEP 3: CRAFT PERSONA
┌─────────────────────────────────────────┐
│  ✅ Reading job description             │  ← Done (green)
│  [Analysis summary]                     │
│                                         │
│  ✅ Analyzing your resume               │  ← Done (green)
│  [Resume analysis]                      │
│  "Strong React experience aligns..."    │
│                                         │
│  🔄 [spinner]                           │
│  Crafting interviewer persona           │  ← Active (yellow)
│  Building a tailored interviewer...      │  ← Subtitle
└─────────────────────────────────────────┘

        ↓ (3-8 seconds)

PERSONA REVEALED
┌─────────────────────────────────────────┐
│  ✅ Reading job description             │
│  ✅ Analyzing your resume               │
│  ✅ Crafting interviewer persona         │  ← Done (green)
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 👤 Sarah Chen                   │    │  ← Persona Name
│  │ Engineering Manager at Stripe,  │    │  ← Persona Role
│  │ 8 years experience               │    │
│  │                                  │    │
│  │ [challenging] [medium]          │    │  ← Style + Difficulty
│  └─────────────────────────────────┘    │
│                                         │
│  🔄 Starting interview...               │  ← Final step
└─────────────────────────────────────────┘
```

---

## Status Icons & Colors

| Step | Active | Done | Pending |
|------|--------|------|---------|
| **Icon** | 🔄 Spinner | ✅ Checkmark | ◡ Gray icon |
| **Color** | Yellow bg | Green | Grayed out |
| **Text** | Black/dark | Green | Light gray |

---

## Persona Card Display

When generation completes, user sees:

```
┌─────────────────────────────────────────────────────────┐
│ PERSONA CARD                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐                                       │
│   │    👤       │  Sarah Chen                           │  ← Name
│   │   (avatar)  │  Engineering Manager at Stripe       │  ← Role
│   │             │  8 years building payment systems     │
│   └─────────────┘                                       │
│                                                         │
│   Style: [conversational]                               │  ← Badge
│   Difficulty: [🎯 medium]                               │  ← Badge
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## During Interview: Where Persona Appears

### Header Bar
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ←  Senior Frontend Interview   [technical]    ⏱️ 24:35    🔇 ⚙️  ⏹️    │
│    Stripe · Senior Frontend Engineer                                  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         └── Persona name not shown here (user knows from prep screen)
```

### Voice Orb Area
```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                      ╭─────────────╮                                   │
│                     ╱   🔮 ORB      ╲                                  │
│                    │   (pulsing)     │                                 │
│                     ╲_______________╱                                  │
│                                                                         │
│              Listening — speak naturally                                │  ← Status
│                                                                         │
│    🟢 Hands-free   🟡 Listening   🟣 Generating                         │  ← Dots
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Transcript Area
```
┌─────────────────────────────────────────────────────────────────────────┐
│ TRANSCRIPT                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🤖 Tell me about your background and what                             │  ← AI (persona)
│     drew you to frontend infrastructure.                              │     speaking
│                                                2:34 PM                  │
│                                                                         │
│  👤 I started at a fintech startup where we...                         │  ← User response
│     [yellow bubble]                             2:35 PM                  │
│                                                                         │
│  🤖 You mentioned leading a TypeScript migration.                       │  ← AI (persona)
│     Walk me through a technical challenge                             │     asking Q2
│     you faced.                                                          │
│                                                2:37 PM                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Note:** The persona's name doesn't appear in every message — it's implied by the 🤖 bot icon and the context from the prep screen.

---

## How Persona Affects Status During Interview

The persona influences what the AI says, but the **status indicators** remain consistent:

| Status | Visual | What User Hears/Sees |
|--------|--------|----------------------|
| **Listening** | 🟡 Yellow pulse | Nothing — waiting for user |
| **Hearing** | 🔴 Orb reacts to voice | Nothing — capturing audio |
| **Transcribing** | 🟠 Amber spinner | Nothing — processing |
| **Thinking** | 🟣 Purple dots | Nothing — AI generating response |
| **Speaking** | 🟡 Yellow wave | **Persona's voice** (Kokoro TTS) |

**The Persona's Impact:**
- Voice gender matches `persona.gender` (if set)
- Questions come from `q1Topic` → `q5Topic` arc
- Follow-ups reference `validateClaim1` and `validateClaim2`
- Tone matches `interviewStyle`

---

## Persona-Related Error States

### Failed Generation
```
┌─────────────────────────────────────────┐
│  ⚠️ Couldn't create custom interviewer  │
│                                         │
│  Using general interviewer instead.     │
│                                         │
│  [Continue Anyway]  [Try Again]          │
└─────────────────────────────────────────┘
```

**What happened:** LLM generation failed  
**Fallback:** Generic persona with standard questions  
**User sees:** Interview proceeds normally

---

## Summary: Status Message → Visual Mapping

| Status Message | Duration | Visual Indicator | Analysis Appears |
|----------------|----------|------------------|------------------|
| "Reading job description" | 1-3 sec | 🔄 Spinner, yellow | When done (green) |
| "Analyzing your resume" | 1-3 sec | 🔄 Spinner, yellow | When done (green) |
| "Crafting interviewer persona" | 3-8 sec | 🔄 Spinner, yellow | Persona card revealed |
| "Starting interview..." | < 1 sec | 🔄 Spinner | Navigation to Interview |

---

## Design Principles

1. **Progressive Disclosure** — Analysis text appears only when step completes (rewards patience)
2. **Visual Feedback** — Color coding: yellow=active, green=done, gray=pending
3. **Reveal Moment** — Persona card is the "payoff" for waiting through generation
4. **Consistency** — Same visual language (spinner, checkmark, card) throughout app
5. **Transparency** — User knows exactly what AI is doing at each step

---

## For Design Teams

**Key UI Components for Persona:**
- `PersonaStep` component (animated step row)
- `PersonaCard` component (revealed at end)
- Status badges (style + difficulty chips)
- Analysis text container (collapsible summary)

**Animation Specs:**
- Step transitions: 300ms ease-out
- Persona card reveal: 400ms slide-up + fade
- Analysis text: 200ms fade-in after checkmark

**Color Tokens:**
- Active step: `bg-lemonade-accent/15` (yellow bg)
- Done step: `bg-green-100` or `bg-green-500/15` (green)
- Pending step: `bg-gray-100` or `bg-white/[0.04]` (gray)
- Persona card border: `border-lemonade-accent/15`

---

*For full persona logic: AGENT_PERSONA_GUIDE.md*  
*For status explanations: STATUS_MESSAGES_QUICK_REFERENCE.md*
