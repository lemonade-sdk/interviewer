# Explicit Status Messages Explained

**For: Product, Design, Engineering, QA, and Leadership Teams**

This document translates every technical status message the app displays into plain English. When someone asks "What does 'Optimizing context window' actually mean?" — this is the answer.

---

## STAGE 1: LANDING PAGE (Document Upload)

### "Uploading Resume..." / "Uploading Job Post..."
**What it means:** The file is being transferred from the user's computer into the application.

**What's actually happening:**
- File is being read into memory
- Base64 encoding for transmission (if using Electron IPC)
- File metadata being recorded (name, size, type)

**How long it takes:** 1-3 seconds for typical files under 5MB

**If it fails:** User sees "Failed to upload [file type]. Please try again."

---

## STAGE 2: SETUP PAGE (AI Document Analysis)

### "Analyzing job posting"
**What it means:** AI is reading the entire job description to understand the role.

**What's actually happening:**
- Extracted text from the job post PDF/DOCX is being sent to the LLM
- AI is identifying: company name, position title, job requirements, interview type indicators
- AI is parsing natural language into structured data

**How long it takes:** 2-4 seconds

---

### "Extracting company"
**What it means:** AI found the company name in the job posting.

**What's actually happening:**
- LLM is scanning for proper nouns that appear to be company names
- Cross-referencing with known patterns ("at Company Name", "Company Name is hiring")
- Populating the "Company" form field

**How long it takes:** < 1 second (part of single LLM call)

---

### "Extracting position"
**What it means:** AI found the job title/role in the job posting.

**What's actually happening:**
- LLM identifying the position being hired for
- Distinguishing between role types (Engineer, Manager, Designer, etc.)
- Populating the "Position" form field

**How long it takes:** < 1 second (part of same LLM call)

---

### "Generating title"
**What it means:** AI is creating a session name for this interview.

**What's actually happening:**
- LLM combining company + position + interview type into a readable title
- Example: "Senior Software Engineer Interview at Stripe"
- Populating the "Title" form field

**How long it takes:** < 1 second (part of same LLM call)

---

### "AI is generating..." (placeholder text)
**What it means:** The field is waiting for AI to finish before showing the value.

**What's actually happening:**
- Input field shows gray placeholder text while extraction in progress
- Prevents user from typing while AI is about to fill it

---

### "AI is filling details..." (button state)
**What it means:** User must wait for AI extraction before continuing.

**What's actually happening:**
- Continue button disabled while extraction in progress
- Shows spinner to indicate active processing
- Prevents user from proceeding with incomplete/partial data

---

## STAGE 3: PREPARATION PAGE (Model Loading)

### "Fetching compatible models..."
**What it means:** App is asking Lemonade Server what AI models are available.

**What's actually happening:**
- HTTP GET request to `/v1/models` endpoint
- Server returns list of all downloaded and available models
- App filters for LLM models (excludes embedding, audio, vision models)
- Models sorted by: suggested > downloaded > alphabetical

**How long it takes:** 1-2 seconds

**If it fails:** Error state: "No compatible LLM models found. Ensure Lemonade Server is running."

---

### "Downloading [model-name]..."
**What it means:** The AI model is being downloaded from the internet.

**What's actually happening:**
- File(s) downloading from HuggingFace or model repository
- Large files (2GB - 8GB typical) being saved to local disk
- Progress bar shows bytes downloaded / total bytes
- May be multiple files (model weights, config, tokenizer)

**How long it takes:** 2-10 minutes depending on connection speed and model size

**Examples:**
- "Downloading Qwen2.5-7B-Instruct..." (4.5 GB)
- "Downloading Whisper-Base for speech recognition..." (150 MB)
- "Downloading Kokoro for text-to-speech..." (300 MB)

---

### "Optimizing [model-name] context window..."
**What it means:** The AI model is being reconfigured to handle longer conversations.

**What's actually happening:**
- Model already loaded in memory, but with default settings (usually 4K context)
- App is unloading and reloading with `ctx_size: 16384` (16K context window)
- This lets the model "remember" more of the interview conversation
- Enables longer interviews without the model forgetting earlier questions

**Technical explanation for engineers:**
```javascript
{ ctx_size: 16384 } // Allocate memory for 16,384 tokens
// Default is often 4096, which fills up fast in a conversation
```

**How long it takes:** 5-15 seconds

**Why this matters:** Without this, the AI interviewer would forget the beginning of the conversation halfway through.

---

### "Unloading [model-name]..."
**What it means:** A different AI model is being removed from memory to make room.

**What's actually happening:**
- Lemonade Server can only load one LLM at a time (GPU memory limit)
- Previous model being unloaded from VRAM/RAM
- Memory being freed for new model

**How long it takes:** 2-5 seconds

---

### "Loading [model-name]..."
**What it means:** The AI model is being loaded into computer memory (RAM/VRAM).

**What's actually happening:**
- Model weights (billions of numbers) being read from disk into memory
- GPU/CPU preparing for inference
- Memory allocation happening
- This is the "Warming up" phase people often ask about

**How long it takes:** 10-30 seconds depending on model size

**Real-world analogy:** It's like moving a large program from your hard drive into active memory so it can run fast.

---

### "Preparing voice features..."
**What it means:** Setting up speech recognition and text-to-speech capabilities.

**What's actually happening:**
- App is identifying which models are needed for voice
- Speech Recognition: Whisper model (converts speech → text)
- Text-to-Speech: Kokoro model (converts text → speech)
- Checking if models are downloaded, loading them if needed

**How long it takes:** 5-20 seconds (may include downloads)

---

### "Loading [model] for speech..."
**What it means:** The text-to-speech model is being loaded.

**What's actually happening:**
- Kokoro TTS model being loaded into memory
- This will speak the interviewer's questions aloud

**How long it takes:** 5-10 seconds

---

### "Warming up the model"
**What it means:** Same as "Loading [model]" — just friendlier language shown in UI.

**What it's NOT:**
- Not heating up hardware
- Not a thermal process
- Just means "getting ready to work"

**What's actually happening:**
- Neural network weights being loaded into GPU/CPU memory
- Model graph being compiled/optimized
- First inference being prepared

---

### "Review your resume while the model downloads"
**What it means:** User can read their resume on the left while waiting on the right.

**What's actually happening:**
- Async download happening in background
- Resume PDF/text displayed in left panel
- User has something useful to do during the 2-10 minute wait

---

### "Review your resume while we get things ready"
**What it means:** Generic encouragement to use the wait time productively.

**What's actually happening:**
- Any preparation step in progress
- Left panel shows resume for review

---

## STAGE 3: PERSONA GENERATION

### "Analyzing job description..."
**What it means:** AI is deeply understanding the role requirements.

**What's actually happening:**
- Full job text sent to LLM
- AI extracting: required skills, experience level, team structure, technical stack
- This understanding will shape the interviewer's personality and questions

**How long it takes:** 1-3 seconds

---

### "Analyzing your resume..."
**What it means:** AI is mapping your background to the job requirements.

**What's actually happening:**
- Resume text sent to LLM
- AI identifying: skills, experience, projects, gaps, strengths
- Creating mental model of who the candidate is

**How long it takes:** 1-3 seconds

---

### "Crafting interviewer persona..."
**What it means:** AI is creating a custom interviewer for this specific role.

**What's actually happening:**
- LLM generating a fictional interviewer identity:
  - Name (e.g., "Sarah Chen")
  - Role (e.g., "Senior Engineering Manager at Stripe")
  - Personality style (conversational, formal, challenging, supportive)
  - 5-phase interview arc (8-15 adaptive exchanges) tailored to the job
- Output is structured JSON with 19 fields

**How long it takes:** 3-8 seconds

**Example output:**
```json
{
  "personaName": "Sarah Chen",
  "personaRole": "Engineering Manager at Stripe, 8 years experience",
  "interviewStyle": "challenging",
  "q1Topic": "Tell me about your background...",
  "q2Topic": "Describe a distributed system you built..."
}
```

---

### "Starting interview..."
**What it means:** Final preparation before the conversation begins.

**What's actually happening:**
- Interview session being created in database
- Persona being associated with interview
- Navigation to Interview page about to happen

**How long it takes:** < 1 second

---

### "Ready!"
**What it means:** Everything is prepared — interview begins now.

**What's actually happening:**
- Final state before navigation
- Success confirmation

---

## STAGE 4: LIVE INTERVIEW (Status Dots & Orb States)

### "Preparing your interview..." (loading screen)
**What it means:** Interview page is loading, voice manager initializing.

**What's actually happening:**
- Interview data being fetched from database
- VoiceInterviewManager being initialized
- TTS voice being selected based on persona gender
- Audio permissions being checked

**How long it takes:** 1-3 seconds

---

### Status Dot: "Hands-free" (Green)
**What it means:** The app is in automatic conversation mode.

**What's actually happening:**
- Voice Activity Detection (VAD) is active
- App automatically listens after AI finishes speaking
- No button pressing required
- User can speak naturally

---

### Status Dot: "Listening" (Yellow)
**What it means:** App is actively waiting for user to speak.

**What's actually happening:**
- Microphone is open
- VAD is monitoring audio levels
- Waiting for speech to begin
- Silence detection active (will timeout eventually)

---

### Status Dot: "Recording" (Red)
**What it means:** Audio is being captured from microphone.

**What's actually happening:**
- MediaRecorder or WebSocket streaming active
- Audio bytes being collected
- Recording will continue until speech ends (VAD) or user stops it

**Note:** In hands-free mode, this is automatic. In manual mode, user pressed a button.

---

### Status Dot: "Transcribing" (Amber/Orange)
**What it means:** Speech is being converted to text.

**What's actually happening:**
- Audio being sent to Whisper model (STT)
- Neural network processing sound waves → words
- If WebSocket: real-time streaming transcription
- If HTTP fallback: processing complete audio file

**How long it takes:** 0.5 - 3 seconds depending on speech length

**UI Text:** "Processing speech..."

---

### Status Dot: "Generating" (Purple)
**What it means:** AI is creating a response to your answer.

**What's actually happening:**
- Transcribed text sent to LLM
- Model generating interviewer's next question/response
- Tokens being generated one by one
- Context window (interview history) being considered

**How long it takes:** 1-5 seconds depending on question complexity

**UI Text:** "Thinking..." or "AI is thinking..."

---

### Status Dot: "Speaking" (Yellow)
**What it means:** AI interviewer is speaking aloud.

**What's actually happening:**
- Generated text being sent to Kokoro TTS model
- Audio being synthesized and played through speakers
- Sentence-by-sentence streaming for faster response
- Waveform visualization active on voice orb

**How long it takes:** 2-10 seconds depending on response length

---

### "Listening — speak naturally"
**What it means:** User can start talking, the app is ready.

**What's actually happening:**
- Hands-free mode active
- VAD waiting for speech onset
- User doesn't need to press any button

---

### "AI is speaking..."
**What it means:** The interviewer is currently talking.

**What's actually happening:**
- TTS audio playing
- Voice orb showing speaking animation
- Auto-listening will resume when done

---

### "AI is thinking..."
**What it means:** The interviewer is preparing its response.

**What's actually happening:**
- LLM generating text response
- User's transcribed answer being processed
- Next question being formulated

---

### "Hands-free mode active"
**What it means:** Default state when hands-free is on but idle.

**What's actually happening:**
- System ready for conversation
- Waiting for AI to speak or user to respond

---

### "Starting hands-free mode..."
**What it means:** Transitioning to automatic listening mode.

**What's actually happening:**
- Voice manager initializing hands-free mode
- VAD starting up
- About to begin listening

---

### "Voice unavailable — use text input"
**What it means:** Microphone or voice services aren't working.

**What's actually happening:**
- Voice manager failed to initialize
- Fallback to text-only mode
- User can type instead of speak
- Could be: no microphone, permission denied, model not loaded

---

### "Your conversation will appear here"
**What it means:** Empty state before any messages.

**What's actually happening:**
- No messages yet
- Waiting for interview to start

---

## STAGE 5: FEEDBACK PAGE

### "Analyzing Your Interview"
**What it means:** AI is reviewing the entire conversation.

**What's actually happening:**
- Each Q&A pair being sent to LLM for grading
- AI evaluating: relevance, depth, clarity, structure
- Generating strengths and improvements per question
- Calculating overall score

**How long it takes:** 10-30 seconds depending on interview length

**Progress shown:** "Question 3 of 8 graded" with progress bar

---

### "[X] of [Y] questions graded"
**What it means:** Progress through feedback generation.

**What's actually happening:**
- Sequential processing of each question
- Each question requires separate LLM call for grading
- Progress bar visualizing completion

---

## ERROR STATES

### "Failed to upload resume. Please try again."
**What it means:** File transfer didn't complete.

**Possible causes:**
- File too large
- Network error (if web version)
- File corruption
- Permission denied

---

### "AI couldn't auto-fill — enter details manually or retry."
**What it means:** Document extraction failed.

**Possible causes:**
- Job post format not parseable (image-based PDF, corrupted file)
- LLM couldn't identify clear company/position
- Document text extraction failed

**User action:** Can manually enter all fields or retry

---

### "Download failed: [reason]"
**What it means:** Model download interrupted.

**Possible causes:**
- Internet connection lost
- Disk full
- Model repository unavailable
- Timeout on large file

---

### "Load failed: [reason]"
**What it means:** Model couldn't be loaded into memory.

**Possible causes:**
- Not enough RAM/VRAM
- Model file corrupted during download
- Incompatible model format
- GPU drivers issue

---

## SUMMARY TABLE

| Status Message | Plain English | Technical Reality | Typical Duration |
|----------------|---------------|-------------------|------------------|
| "Uploading..." | Saving your file | File I/O + encoding | 1-3 sec |
| "Analyzing job posting" | AI reading job description | LLM inference | 2-4 sec |
| "Extracting company" | Finding company name | Text parsing | < 1 sec |
| "Fetching models" | Getting available AI list | HTTP GET /v1/models | 1-2 sec |
| "Downloading [model]" | Downloading AI from internet | File download (2-8GB) | 2-10 min |
| "Optimizing context window" | Expanding AI memory | Reload with ctx_size: 16384 | 5-15 sec |
| "Loading [model]" / "Warming up" | Starting up AI | Model weights → RAM/VRAM | 10-30 sec |
| "Preparing voice features" | Setting up speech | Load Whisper + Kokoro | 5-20 sec |
| "Crafting persona" | Creating custom interviewer | LLM generation (19 fields) | 3-8 sec |
| "Transcribing" | Converting speech to text | Whisper STT inference | 0.5-3 sec |
| "Generating" / "Thinking" | AI creating response | LLM token generation | 1-5 sec |
| "Speaking" | AI talking aloud | Kokoro TTS + playback | 2-10 sec |
| "Analyzing Your Interview" | Grading all answers | Per-question LLM grading | 10-30 sec |

---

## FAQ: Common Questions from Stakeholders

### Q: Why does "Warming up the model" take so long?
**A:** The AI model is billions of numbers (parameters) being moved from your hard drive into active memory (RAM/VRAM). Think of it like loading a massive program before it can run. Bigger models = longer load times.

### Q: What's a "context window" and why does it need optimizing?
**A:** It's how much the AI can "remember" at once. Default is often 4,000 tokens (words). We're expanding to 16,000 so the interviewer can remember your earlier answers throughout a 30-minute interview.

### Q: Why do we need to download separate models for speech?
**A:** Different tasks need different AI models:
- **LLM (Qwen)**: Understands and generates text — the interviewer brain
- **Whisper**: Specialized for speech recognition — converts voice to text
- **Kokoro**: Specialized for text-to-speech — makes the interviewer talk

### Q: What's the difference between "Loading" and "Downloading"?
**A:** 
- **Downloading** = Getting the file from the internet (once)
- **Loading** = Putting it into computer memory to use it (every time you start)

### Q: Why is persona generation separate from model loading?
**A:** Persona generation uses the LLM to "think" about the job and resume. It can only happen AFTER the LLM is loaded. It's essentially asking the AI: "Based on these documents, what kind of interviewer should you be?"
