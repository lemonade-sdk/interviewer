# Interviewer App - UI/UX Process Slides

---

# SLIDE 1: Title Slide

## AI-Powered Interview Practice App
### UI/UX Process Documentation

**Powered by Lemonade Open APIs**
- Local-first AI models
- Privacy by design
- Zero cloud dependencies

---

# SLIDE 2: The Vision

## What We're Building

A **voice-first interview practice application** that:
- Simulates real job interviews with AI interviewers
- Provides detailed feedback on every answer
- Runs entirely on-device (no data sent to cloud)
- Uses hands-free voice conversation

**Key Differentiator**: Unlike SaaS interview tools, this app uses **Lemonade Open APIs** for local AI inference — complete privacy, no subscription fees.

---

# SLIDE 3: Technology Foundation

## Powered by Lemonade Open APIs

| Capability | API | What It Does |
|------------|-----|--------------|
| Interview AI | `/chat/completions` | Conducts intelligent interview conversation |
| Speech-to-Text | Whisper | Transcribes user's spoken answers |
| Text-to-Speech | Kokoro | Speaks interviewer's questions |
| Document Analysis | LLM + Extraction | Reads resumes and job posts |
| Persona Generation | LLM | Creates custom interviewers per role |

**All models run locally on user's device**

---

# SLIDE 4: User Journey Overview

## The 6 Stages

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ LANDING │──▶│  SETUP  │──▶│PREPARING│──▶│INTERVIEW│──▶│ FEEDBACK│──▶│DASHBOARD│
│  Upload │   │AI Extraction│ Model Load│ Voice Chat│ Analysis  │ Progress │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

---

# SLIDE 5: Stage 1 — Landing Page

## Document Upload

**What User Sees:**
- Clean centered layout with app logo
- Two prominent upload zones:
  - **Resume** (PDF, DOC, DOCX, TXT)
  - **Job Post** (same formats)
- System status indicator
- "Begin" button (disabled until ready)

**UI Feedback:**
- Checkmarks appear when files uploaded
- Error states if Lemonade Server not installed
- Helpful instructions for setup

**Behind the Scenes:**
- Documents processed locally
- Text extracted for AI analysis

---

# SLIDE 6: Stage 2 — Setup & AI Extraction

## AI Reads Your Documents

**What User Sees:**
Form fields that **auto-populate** as AI extracts data:
- Interview Title
- Company Name
- Position Title
- Interview Type

**Visual Progress Steps:**
1. 🔄 Analyzing job posting
2. 🔄 Extracting company
3. 🔄 Extracting position
4. 🔄 Generating title
5. ✅ Details auto-filled

**User Can:**
- Watch AI fill fields in real-time
- Edit any auto-filled information
- Select interview type (Technical, Behavioral, etc.)
- Go back to change documents

---

# SLIDE 7: Stage 3 — Preparation (Part 1)

## Model Selection

**Split-Screen Layout:**
- **Left**: Resume preview (PDF or text)
- **Right**: AI model selection panel

**Model Cards Show:**
- Model name and size (e.g., "Qwen2.5-7B-Instruct — 4.5 GB")
- ⭐ "Suggested" badge (AI-recommended)
- ✅ "Ready" badge (already downloaded)
- ⬇️ "Download" badge (needs download)

**User Selects:**
- AI model for the interview
- Interview style (Conversational / Formal / Challenging / Supportive)
- Question difficulty (Easy / Medium / Hard)

---

# SLIDE 8: Stage 3 — Preparation (Part 2)

## Download, Load & Persona Generation

**If Model Needs Download:**
- Progress bar with percentage
- "3.2 GB / 4.5 GB downloaded"
- "Review your resume while waiting"

**Model Loading:**
- Animated spinner
- "Warming up Qwen2.5-7B..."
- "This can take a moment"

**Voice Features Auto-Load:**
- Speech Recognition (Whisper)
- Text-to-Speech (Kokoro)

**Persona Generation (AI Creates Your Interviewer):**
1. 🔄 Reading job description
2. 🔄 Analyzing your resume
3. 🔄 Crafting interviewer persona
4. ✅ Meet "Sarah Chen — Senior Engineering Manager"

---

# SLIDE 9: Stage 4 — Live Interview (The Core Experience)

## Hands-Free Voice Conversation

**Main Interface:**
- **Header**: Title | Timer (24:35) | Mute | Settings | End
- **Center**: Large animated Voice Orb
- **Bottom**: Live transcript panel

**Voice Orb States:**
| State | Visual Feedback |
|-------|-----------------|
| Idle | Soft pulsing glow |
| Listening | Waveform visualization |
| User Speaking | Pulses with voice volume |
| AI Thinking | Animated dots |
| AI Speaking | Active waveform |

**Status Dots:**
🟢 Hands-free | 🟡 Listening | 🔴 Recording | 🟣 Generating | 🟡 Speaking

---

# SLIDE 10: Stage 4 — Interview Flow

## How the Conversation Works

**Natural Turn-Taking:**
```
AI SPEAKS ────────▶ Orb shows speaking animation
      │
      ▼
AUTO-LISTENING ───▶ "Listening — speak naturally"
      │
      ▼
USER SPEAKS ──────▶ Orb pulses with voice
      │
      ▼
TRANSCRIBING ─────▶ Processing speech...
      │
      ▼
AI THINKING ──────▶ Animated thinking dots
      │
      ▼
AI RESPONDS ──────▶ Text appears + AI speaks
      │
      ▼
   (repeat)
```

**No buttons to press — completely hands-free!**

---

# SLIDE 11: Stage 4 — Transcript & Controls

## Conversation History

**Message Bubbles:**
- **User** (yellow, right side): "I led the migration to microservices..."
- **AI Interviewer** (gray, left side): "Tell me about a challenging project..."

**Real-Time Features:**
- Live transcription preview while speaking
- Timestamps on every message
- Auto-scroll to latest
- Optional text input (toggle on/off)

**Timer:**
- Counts down from 30 minutes
- Yellow warning at 24 minutes
- Red + flash at 0 minutes (auto-ends)

**User Controls:**
- 🔇 Mute AI voice
- ⌨️ Toggle text input
- ⚙️ Audio settings (mic, sensitivity)
- ⏹️ End interview → Feedback

---

# SLIDE 12: Stage 5 — Interview Feedback

## AI-Generated Performance Analysis

**Header:**
- Overall Score: "78%" with trophy icon
- Question counter: "Question 3 of 8"

**Left Panel — Q&A Review:**
- **Question**: "Describe a time you had to debug a production issue..."
- **Your Answer**: Full transcript of what user said
- **Suggested Response**: AI's model answer for reference
- **Rating Badge**: "Good" (yellow) with score "72/100"

**Right Panel — Feedback:**
- ✅ **Strengths** (green box):
  - + Clear problem description
  - + Mentioned specific tools used
  
- ⚠️ **Areas to Improve** (yellow box):
  - ! Could quantify the impact more
  - ! Missing what you learned

---

# SLIDE 13: Stage 5 — Feedback Navigation

## Review All Questions

**Question Navigator Grid:**
```
┌───┬───┬───┬───┬───┐
│ 1 │ 2 │ 3 │ 4 │ 5 │   ◀── Green = Excellent
├───┼───┼───┼───┼───┤
│ 6 │ 7 │ 8 │   │   │   ◀── Yellow = Good
└───┴───┴───┴───┴───┘   ◀── Red = Needs Improvement
```

**Navigation:**
- Click any number to jump to that question
- Previous / Next buttons
- Progress dots at bottom
- "Done" button returns to Dashboard

**Progressive Disclosure:**
- Deep feedback per question
- Easy to compare across all questions
- Focus on improvement areas

---

# SLIDE 14: Stage 6 — Dashboard

## Progress Hub

**Statistics Cards:**
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Total          │  │ Average Score  │  │ In Progress    │
│ Interviews     │  │ 78%            │  │ 1              │
│ 12             │  │ ⭐             │  │ 📝             │
└────────────────┘  └────────────────┘  └────────────────┘

**In Progress Section:**
- Card: "Senior Frontend Interview at Stripe"
- Started: "Today, 2:30 PM"
- Click to resume

**Recent Activity:**
- List of completed interviews
- Shows: Title | Company | Type | Date | Score
- Click to view full feedback
- Color-coded by score

**Empty State:**
- "No interviews yet"
- "Start your first AI-powered interview"
- CTA button to begin

---

# SLIDE 15: Key UX Principles

## Design Philosophy

### 1. **Transparency**
- User always knows what AI is doing
- Step-by-step progress for all AI operations
- "AI is reading your job post..."

### 2. **Graceful Degradation**
- Voice fails? → Text mode works
- AI extraction fails? → Manual entry available
- Model not downloaded? → Clear instructions

### 3. **Privacy by Design**
- No data leaves device
- All AI runs locally via Lemonade
- No accounts or logins needed

### 4. **Progressive Disclosure**
- Simple default experience
- Advanced settings tucked away
- Power features available but not overwhelming

### 5. **Immediate Feedback**
- Real-time transcription
- Streaming AI responses
- Visual audio indicators

---

# SLIDE 16: Voice Architecture

## How Hands-Free Mode Works

```
┌─────────────┐
│ USER SPEAKS │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Voice       │───▶│ VAD         │───▶│ Speech-to-  │
│ Activity    │    │ (detects    │    │ Text        │
│ Detection   │    │ start/end)  │    │ (Whisper)   │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                        ┌─────────────┐
                                        │ AI          │
                                        │ Interviewer │
                                        │ (LLM)       │
                                        └──────┬──────┘
                                               │
                     ┌─────────────────────────┘
                     │
                     ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ USER HEARS  │◀───│ Text-to-    │◀───│ Sentence    │
│ RESPONSE    │    │ Speech      │    │ Chunker     │
│ (auto-listens│    │ (Kokoro)    │    │ (streaming) │
│ for next)   │    └─────────────┘    └─────────────┘
└─────────────┘
```

---

# SLIDE 17: Summary

## The Complete Experience

| Stage | What Happens | User Sees |
|-------|--------------|-----------|
| **1. Landing** | Upload docs | Clean upload UI, status checks |
| **2. Setup** | AI extraction | Fields auto-fill with progress |
| **3. Preparing** | Load models, generate persona | Resume preview + step-by-step progress |
| **4. Interview** | Voice conversation | Voice orb, transcript, status dots |
| **5. Feedback** | AI grades answers | Q&A review, strengths, improvements |
| **6. Dashboard** | Track progress | Stats, history, resume interview |

---

# SLIDE 18: Value Proposition

## Why This App Wins

**vs. SaaS Interview Tools:**
| | SaaS Tools | This App |
|---|------------|----------|
| Privacy | ❌ Data sent to cloud | ✅ Local only |
| Cost | ❌ Monthly subscription | ✅ Free (local models) |
| Offline | ❌ Internet required | ✅ Works offline |
| Customization | ❌ Generic interviews | ✅ Tailored per job/role |
| Voice | ❌ Text-only or limited | ✅ Full hands-free voice |

**Powered by Lemonade Open APIs — Local AI for Everyone**

---

# SLIDE 19: Questions?

## Discussion

**Team Review Topics:**
1. Does the 6-stage flow make sense?
2. Are there too many/too few progress steps?
3. Is the voice-first approach clear?
4. Should we add more customization options?
5. How can we make feedback even more actionable?

**Next Steps:**
- [ ] Design team to create high-fidelity mockups
- [ ] Engineering to implement Lemonade API integration
- [ ] QA to test voice flow edge cases
- [ ] Content to refine AI prompts for feedback

---

# SLIDE 20: Appendix

## Technical Notes for Engineering

**Lemonade API Endpoints Used:**
```
POST /v1/chat/completions      # Interview AI + Persona generation
POST /v1/audio/transcriptions  # Whisper speech-to-text
POST /v1/audio/speech          # Kokoro text-to-speech
GET  /v1/models                # List compatible models
POST /v1/models/load         # Load model into memory
POST /v1/models/unload       # Unload model
```

**Key Libraries:**
- Web Audio API for voice activity detection
- MediaRecorder for audio capture
- WebSocket for streaming transcription (optional)
- PDF.js for resume preview

**Browser Support:**
- Chrome/Edge: Full support (WebSocket + Web Audio)
- Firefox: Full support (HTTP fallback for ASR)
- Safari: Supported (with limitations)
