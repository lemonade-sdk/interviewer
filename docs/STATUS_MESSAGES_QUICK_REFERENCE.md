# Status Messages Quick Reference

## One-Liner Explanations for Team Reference

---

### 📄 DOCUMENT UPLOAD
| Message | What It Means | Duration |
|---------|---------------|----------|
| "Uploading Resume..." | Saving your file to the app | 1-3 sec |
| "Uploading Job Post..." | Saving job description | 1-3 sec |

---

### 🤖 AI DOCUMENT ANALYSIS
| Message | What It Means | Duration |
|---------|---------------|----------|
| "Analyzing job posting" | AI reading the entire job description | 2-4 sec |
| "Extracting company" | AI finding the company name | < 1 sec |
| "Extracting position" | AI finding the job title | < 1 sec |
| "Generating title" | AI creating session name | < 1 sec |
| "AI is generating..." | Waiting for AI to fill this field | — |
| "AI is filling details..." | Please wait while AI populates form | — |

---

### ⬇️ MODEL PREPARATION
| Message | What It Means | Duration |
|---------|---------------|----------|
| "Fetching compatible models..." | Getting list of available AI models | 1-2 sec |
| "Downloading [model-name]..." | Downloading AI from internet (2-8 GB) | 2-10 min |
| "Optimizing [model] context window..." | Expanding AI memory to remember longer conversations | 5-15 sec |
| "Unloading [model]..." | Removing old model to make room | 2-5 sec |
| "Loading [model]..." / "Warming up" | Starting up AI (moving to memory) | 10-30 sec |
| "Preparing voice features..." | Setting up speech recognition + voice output | 5-20 sec |
| "Loading [model] for speech..." | Starting text-to-speech engine | 5-10 sec |

**Real-world analogy for "Warming up":** Like moving a program from hard drive into active memory so it can run.

**Why "Optimizing context window" matters:** Expands AI memory from 4,000 words to 16,000 words so it doesn't forget the start of your interview.

---

### 🎭 PERSONA CREATION
| Message | What It Means | Duration |
|---------|---------------|----------|
| "Analyzing job description..." | AI understanding role requirements | 1-3 sec |
| "Analyzing your resume..." | AI mapping your background to the job | 1-3 sec |
| "Crafting interviewer persona..." | AI creating a custom interviewer (name, personality, questions) | 3-8 sec |
| "Starting interview..." | Final preparation before conversation | < 1 sec |
| "Ready!" | All set — interview beginning now | — |

---

### 🎤 LIVE INTERVIEW STATES
| Status Dot | Message | What It Means |
|------------|---------|---------------|
| 🟢 Green | "Hands-free" | Automatic mode — no buttons needed |
| 🟡 Yellow | "Listening" | Waiting for you to speak |
| 🔴 Red | "Recording" | Capturing your audio |
| 🟠 Amber | "Transcribing" / "Processing speech..." | Converting voice to text |
| 🟣 Purple | "Generating" / "Thinking..." | AI creating a response |
| 🟡 Yellow | "Speaking" | AI interviewer talking aloud |

**Voice Orb Messages:**
- "Listening — speak naturally" → Go ahead, I'm ready
- "AI is speaking..." → Interviewer is talking
- "AI is thinking..." → Preparing next question
- "Hands-free mode active" → Ready for natural conversation
- "Starting hands-free mode..." → Auto-listening activating
- "Voice unavailable — use text input" → Mic not working, type instead

---

### 📊 FEEDBACK GENERATION
| Message | What It Means | Duration |
|---------|---------------|----------|
| "Analyzing Your Interview" | AI reviewing all your answers | 10-30 sec |
| "[X] of [Y] questions graded" | Progress through grading | — |

---

### ⚠️ ERROR MESSAGES
| Message | What It Means | User Should... |
|---------|---------------|----------------|
| "Failed to upload resume..." | File didn't save | Try again, check file size |
| "AI couldn't auto-fill..." | Couldn't read document | Enter details manually |
| "Download failed..." | Internet/model issue | Check connection, retry |
| "Load failed..." | Not enough memory | Try smaller model, close apps |

---

## The Big Picture Flow

```
UPLOAD (2 files)
    ↓
AI READS (extracts company, position, title)
    ↓
PICK AI MODEL (or download if needed)
    ↓
LOAD MODEL ("warming up" — move to memory)
    ↓
OPTIMIZE (expand memory for long conversations)
    ↓
LOAD VOICE (speech recognition + text-to-speech)
    ↓
CREATE PERSONA (custom interviewer for this job)
    ↓
INTERVIEW STARTS (hands-free voice conversation)
    ↓
GENERATE FEEDBACK (grade each answer)
```

---

## Technical Glossary for Non-Engineers

| Term | Simple Explanation |
|------|-------------------|
| **Context Window** | How much the AI can remember at once (like short-term memory) |
| **Model** | The AI brain — billions of parameters trained on text |
| **Loading** | Moving the model from disk into active memory (RAM/VRAM) |
| **Downloading** | Getting the model files from the internet |
| **Inference** | AI "thinking" — generating text from input |
| **Tokens** | Pieces of words ( roughly 0.75 words per token) |
| **STT** | Speech-to-Text (voice → written words) |
| **TTS** | Text-to-Speech (written words → voice) |
| **VAD** | Voice Activity Detection (knows when you start/stop talking) |
| **VRAM** | Video card memory (faster for AI than regular RAM) |

---

## Most Asked Questions

**Q: Why does "Warming up" take 10-30 seconds?**  
A: Moving billions of AI parameters from hard drive into memory. Like loading a massive program.

**Q: What's "Optimizing context window"?**  
A: Expanding AI memory from 4K to 16K tokens so it remembers your whole 30-min interview.

**Q: Why download separate speech models?**  
A: LLM = interview brain, Whisper = ears (hearing), Kokoro = mouth (speaking). Different jobs need different specialists.

**Q: Loading vs Downloading?**  
A: Download = get from internet (once). Load = put in memory to use (every session).

---

*For full explanations, see EXPLICIT_STATUS_MESSAGES_EXPLAINED.md*
