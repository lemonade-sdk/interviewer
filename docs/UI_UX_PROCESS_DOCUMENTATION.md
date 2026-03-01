# Interviewer App - UI/UX Process Documentation

## Powered by Lemonade Open APIs

This application is built on top of **Lemonade Open APIs**, leveraging local-first AI models that run entirely on your device. This means:
- **Privacy-First**: Your resume, job posts, and interview data never leave your machine
- **Offline Capable**: No internet required after initial model download
- **Fast & Responsive**: Local inference delivers real-time interview experiences
- **Cost Effective**: No per-usage API fees — models run locally

---

## Stage 1: Landing & Document Upload

### What the User Sees
A clean, minimal landing page with two prominent upload buttons and a "Begin" button.

**Visual Design:**
- Centered logo and app name
- Two large dashed-border upload areas (Resume & Job Post)
- System status indicator showing Lemonade Server connection
- Dark/light mode support

**User Flow:**
1. User uploads their resume (PDF, DOC, DOCX, or TXT)
2. User uploads the job posting they're interviewing for
3. System checks that Lemonade Server is installed and running
4. Once both documents are uploaded and server is ready, "Begin" button activates

**UI Feedback:**
- Upload areas show file name with checkmark when complete
- Error messages if Lemonade Server isn't installed/running with helpful instructions
- Loading spinner during server connection check

---

## Stage 2: Setup & AI Auto-Extraction

### What the User Sees
A form pre-filled by AI with interview details extracted from the job posting.

**Visual Design:**
- Clean card-based layout with input fields
- Progress indicators showing AI analysis status
- Animated step-by-step extraction visualization
- Real-time field population as AI extracts data

**AI-Powered Auto-Extraction:**
- **Step 1**: "Analyzing job posting" — AI reads the entire job description
- **Step 2**: "Extracting company" — Identifies the hiring company
- **Step 3**: "Extracting position" — Identifies the role title
- **Step 4**: "Generating title" — Creates an interview session name

**User Can:**
- Review and edit any auto-filled field
- Select interview type (General, Technical, Behavioral, System Design, Coding, Mixed)
- See attached file names as tags
- Navigate back to change documents if needed

**UI Feedback:**
- Each field shows loading indicator while AI extracts
- Green checkmark when extraction complete
- Warning message if auto-extraction fails (user can manually enter)
- Continue button activates when all required fields are valid

---

## Stage 3: Preparation & Model Selection

### What the User Sees
A split-screen layout: resume preview on the left, AI model selection and preparation status on the right.

**Visual Design:**
- Left panel: Resume preview (PDF viewer or text view)
- Right panel: Vertical step-by-step preparation progress
- Model selection cards showing available AI models
- Progress bars and status indicators

**Preparation Pipeline:**

#### Phase 1: Model Selection
User sees a list of compatible AI models with:
- Model name and size
- "Suggested" badge for recommended models
- "Ready" badge for already-downloaded models
- "Download" badge for models that need downloading
- Interview style selection (Conversational, Formal, Challenging, Supportive)
- Difficulty selection (Easy, Medium, Hard)

#### Phase 2: Model Download (if needed)
If selected model isn't downloaded:
- Progress bar with percentage
- Bytes downloaded / total
- Current file being downloaded
- Message: "Review your resume while the model downloads"

#### Phase 3: Model Loading
- Animated spinner with model name
- Status text: "Loading [Model Name]..."
- Subtext: "Warming up the model — this can take a moment"

#### Phase 4: Voice Features Preparation
System automatically downloads and loads:
- Speech Recognition model (Whisper) for transcribing user voice
- Text-to-Speech model (Kokoro) for AI interviewer voice

#### Phase 5: Persona Generation
AI creates a custom interviewer persona based on documents:
- **Step 1**: "Reading job description" — AI understands role requirements
- **Step 2**: "Analyzing your resume" — AI maps your experience to the role
- **Step 3**: "Crafting interviewer persona" — AI creates a tailored interviewer

**UI Feedback:**
- Each step shows animated icon (spinner, checkmark, or pending)
- Analysis text appears for completed steps
- Final persona card displays with name, description, style, and difficulty
- Transition to interview when complete

---

## Stage 4: Live Interview

### What the User Sees
A conversational interface with a voice orb, transcript area, and status indicators.

**Visual Design:**
- Header with interview title, company, position, and timer
- Large central voice orb that responds to audio and AI states
- Transcript panel showing conversation history
- Status dots showing current mode (Hands-free, Listening, Thinking, Speaking)
- Optional text input area (can be toggled)

**Hands-Free Voice Mode:**
The app enters "hands-free" mode where:
- AI automatically listens when it finishes speaking
- User speaks naturally — no button pressing needed
- Voice Activity Detection (VAD) detects when user starts/stops talking
- AI automatically responds after user finishes

**Voice Orb States:**
| State | Visual |
|-------|--------|
| Idle | Soft pulsing yellow glow |
| Listening | Active audio waveform visualization |
| User Speaking | Orb pulses with voice amplitude |
| AI Thinking | Animated thinking dots |
| AI Speaking | Active waveform with speaking animation |
| Transcribing | Spinning indicator |

**Status Indicators:**
- **Hands-free** (green): Natural conversation mode active
- **Listening** (yellow): Waiting for user to speak
- **Recording** (red): Capturing audio
- **Transcribing** (amber): Converting speech to text
- **Generating** (purple): AI creating response
- **Speaking** (yellow): AI speaking response

**Timer Display:**
- Shows remaining time (e.g., "24:35")
- Turns yellow at 80% time elapsed
- Turns red and pulses when time expired
- Interview auto-ends when timer hits zero

**Transcript Area:**
- User messages: Yellow bubbles on the right
- AI messages: Gray bubbles on the left with bot icon
- Timestamps on each message
- Real-time transcription preview while user speaks
- Auto-scrolls to latest message

**User Controls:**
- **Mute/Unmute**: Silence AI voice output
- **Toggle Text Input**: Show/hide text input area
- **Audio Settings**: Adjust microphone, speakers, voice sensitivity
- **End Interview**: Confirm and exit to feedback

**Error Handling:**
- If voice features fail, gracefully falls back to text-only mode
- Clear messaging when microphone access is denied
- Auto-retry for speech recognition errors

---

## Stage 5: Interview Feedback

### What the User Sees
A detailed post-interview analysis with question-by-question breakdown and overall score.

**Visual Design:**
- Header with overall score and trophy icon
- Split layout: Q&A on left, feedback on right
- Color-coded rating badges (Green=Excellent, Yellow=Good, Red=Needs Improvement)
- Question navigator grid at bottom
- Progress bar during feedback generation

**Feedback Generation Loading:**
- Animated spinner with "Analyzing Your Interview"
- Status message showing current analysis step
- Progress bar: "X of Y questions graded"
- Takes 10-30 seconds depending on interview length

**Question Review Interface:**
- **Question Section**: Shows the interviewer's exact question
- **Your Answer Section**: Shows what the user responded
- **Suggested Response**: AI-generated model answer (if available)
- **Rating Badge**: Score (0-100) with text rating
- **Strengths List**: Green box with bullet points of what went well
- **Improvements List**: Yellow/Red box with actionable feedback

**Navigation:**
- Previous/Next buttons to move between questions
- Question grid showing all questions as numbered buttons
- Color-coded by rating (green/yellow/red)
- Current question highlighted with larger dot
- "Done" button returns to dashboard

**Feedback Content:**
Each question includes:
- Specific strengths with evidence from the answer
- Targeted areas for improvement
- What a strong answer would include
- Overall score (0-100) and rating level

---

## Stage 6: Dashboard

### What the User Sees
An overview hub showing interview history, statistics, and quick actions.

**Visual Design:**
- Clean stats cards at top
- "In Progress" section for active interviews
- "Recent Activity" list of completed interviews
- Empty state with call-to-action for new users

**Statistics Cards:**
- **Total Interviews**: Count of all interviews taken
- **Average Score**: Overall performance percentage (highlighted in yellow)
- **In Progress**: Number of active/interrupted interviews

**In Progress Section:**
- Card for each ongoing interview
- Shows title, company, position, and start time
- Click to resume the interview
- Interviews auto-save transcript every few seconds

**Recent Activity List:**
- Chronological list of completed interviews
- Each item shows: Title, Company, Interview Type badge, Date, Score
- Click to view full feedback
- Color-coded score indicators

**Empty State:**
- Large message icon
- "No interviews yet" heading
- Description of benefits
- "Start Interview" call-to-action button

**Quick Actions:**
- "New Interview" button always visible in header
- Returns to Landing page to start fresh session

---

## Key UX Principles

### 1. Transparency
- User always knows what the AI is doing
- Step-by-step progress indicators for all AI operations
- Clear status messages during loading/generation

### 2. Graceful Degradation
- If voice fails, text mode works seamlessly
- If AI extraction fails, manual entry is available
- If models aren't downloaded, clear download instructions shown

### 3. Privacy by Design
- No data leaves the user's device
- All AI runs locally via Lemonade Server
- No cloud accounts or logins required

### 4. Progressive Disclosure
- Complex settings hidden behind "Audio Settings" panel
- Advanced options available but not overwhelming
- Clean default experience for new users

### 5. Feedback Loops
- Immediate visual feedback for all user actions
- Real-time transcription shows user their speech is being captured
- AI response streams word-by-word (not waiting for full response)

---

## Technical Architecture Overview

### Lemonade Open APIs Used

| Feature | API | Purpose |
|---------|-----|---------|
| Interview AI | `/v1/chat/completions` | LLM inference for interview conversation |
| Persona Generation | `/v1/chat/completions` | Generate custom interviewer from documents |
| Speech-to-Text | `/v1/audio/transcriptions` (Whisper) | Transcribe user voice input |
| Text-to-Speech | `/v1/audio/speech` (Kokoro) | Speak AI responses aloud |
| Document Processing | Custom extraction | Parse PDF/DOCX files |
| Model Management | `/v1/models` | Download, load, unload AI models |

### Voice Flow Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   User      │────▶│   Voice Orb   │────▶│    VAD      │
│  Speaks     │     │  (Visual)     │     │  Detection  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                       ┌────────────────────────┘
                       ▼
              ┌─────────────────┐
              │  Speech-to-Text │
              │    (Whisper)    │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Lemonade LLM  │
              │  (Interview AI) │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Text-to-Speech   │
              │    (Kokoro)       │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  User Hears AI    │
              │  Auto-listens next│
              └─────────────────┘
```

---

## Summary

This interview application provides a **seamless, hands-free interview practice experience** powered entirely by local AI through Lemonade Open APIs. The UI guides users through:

1. **Document Upload** → AI reads and understands their resume and job post
2. **Auto-Setup** → AI extracts company, position, and creates session
3. **Preparation** → AI loads models and creates a custom interviewer persona
4. **Live Interview** → Natural voice conversation with real-time transcription
5. **Feedback** → Detailed question-by-question analysis and improvement tips
6. **Progress Tracking** → Dashboard showing growth over time

All while maintaining **complete privacy** (data never leaves device) and **zero ongoing costs** (models run locally).
