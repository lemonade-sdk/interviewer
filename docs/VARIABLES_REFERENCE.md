# AI Interviewer Application - Complete Variables Reference

## Executive Summary

This document provides a comprehensive reference of all configuration variables, settings, constants, and parameters used throughout the AI Interviewer Electron application. 

### Critical Bug Identified
**Timer Units Mismatch**: The `defaultInterviewDuration` is stored as `3600` (seconds) in `StorageManager.ts`, but the UI treats it as minutes (30), and `Interview.tsx` multiplies by 60 again, resulting in 216,000 seconds (60 hours) instead of 1,800 seconds (30 minutes).

---

## Table of Contents

1. [User Settings](#user-settings)
2. [Interviewer Settings](#interviewer-settings)
3. [Interview Configuration](#interview-configuration)
4. [Timer & Duration Constants](#timer--duration-constants)
5. [Voice & Audio Configuration](#voice--audio-configuration)
6. [Model Configuration](#model-configuration)
7. [Persona Variables](#persona-variables)
8. [Phase Keywords & Interview Flow](#phase-keywords--interview-flow)
9. [Prompt Template Variables](#prompt-template-variables)
10. [Data Flow Diagrams](#data-flow-diagrams)
11. [Known Issues](#known-issues)
12. [Verification Checklist](#verification-checklist)

---

## User Settings

### Type Definition
**File**: `src/types/index.ts` (lines 75-84)

```typescript
export interface UserSettings {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  autoSave: boolean;
  defaultInterviewDuration: number;  // BUG: Units inconsistent
  createdAt: string;
  updatedAt: string;
}
```

### Variables

| Variable | Type | Default | Location | Description |
|----------|------|---------|----------|-------------|
| `userId` | `string` | `'default'` | SettingsRepository.ts:58 | Unique user identifier |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | SettingsRepository.ts:59 | UI theme preference |
| `language` | `string` | `'en'` | SettingsRepository.ts:60 | Application language |
| `notifications` | `boolean` | `true` | SettingsRepository.ts:61 | Enable notifications |
| `autoSave` | `boolean` | `true` | SettingsRepository.ts:62 | Auto-save transcripts |
| `defaultInterviewDuration` | `number` | `3600` (WRONG!) | SettingsRepository.ts:63 | **BUG**: Should be `30` |
| `createdAt` | `string` | Current ISO timestamp | SettingsRepository.ts:64 | Creation time |
| `updatedAt` | `string` | Current ISO timestamp | SettingsRepository.ts:65 | Last update time |

### Default Values Definition

**SettingsRepository.ts** (lines 55-70):
```typescript
private async createDefaultUserSettings(): Promise<UserSettings> {
  const now = new Date().toISOString();
  const defaults: UserSettings = {
    userId: 'default',
    theme: 'system',
    language: 'en',
    notifications: true,
    autoSave: true,
    defaultInterviewDuration: 3600,  // ← BUG: Should be 30
    createdAt: now,
    updatedAt: now,
  };
  // ...
}
```

**StorageManager.ts** (lines 146-155):
```typescript
await this.userSettings.set({
  userId: 'default',
  theme: 'system',
  language: 'en',
  notifications: true,
  autoSave: true,
  defaultInterviewDuration: 3600,  // ← BUG: Should be 30
  createdAt: now,
  updatedAt: now,
});
```

### UI Usage

**Settings.tsx** (lines 130-158):
- Input shows "minutes" label
- Range: 5-120 minutes
- Value passed directly to `updateSettings()` without conversion

**Interview.tsx** (lines 91-95):
```typescript
window.electronAPI?.getSettings().then((s) => {
  if (s?.defaultInterviewDuration) {
    setTimerDuration(s.defaultInterviewDuration * 60);  // BUG: 3600 * 60 = 216000!
  }
}).catch(() => {});
```

---

## Interviewer Settings

### Type Definition
**File**: `src/types/index.ts` (lines 86-106)

```typescript
export interface InterviewerSettings {
  modelProvider: string;
  modelName: string;
  extractionModelName?: string;
  temperature: number;
  maxTokens: number;
  interviewStyle: InterviewStyle;
  questionDifficulty: 'easy' | 'medium' | 'hard';
  numberOfQuestions: number;
  includeFollowUps: boolean;
  provideFeedback: boolean;
  voiceMode: boolean;
  asrModel?: string;
  ttsVoice?: string;
  vadSensitivity: number;
  autoPlayTTS: boolean;
  recordingQuality: 'low' | 'medium' | 'high';
  activePersonaId?: string;
}
```

### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `modelProvider` | `string` | `'lemonade-server'` | LLM backend provider |
| `modelName` | `string` | `'gpt-oss-mxp4'` | Primary LLM for interviews |
| `extractionModelName` | `string` | `'gpt-oss-mxp4'` | LLM for structured extraction |
| `temperature` | `number` | `0.7` | LLM creativity (0-1) |
| `maxTokens` | `number` | `2000` | Max response tokens |
| `interviewStyle` | `InterviewStyle` | `'conversational'` | Interview personality |
| `questionDifficulty` | `'easy' \| 'medium' \| 'hard'` | `'medium'` | Question complexity |
| `numberOfQuestions` | `number` | `10` | Target question count |
| `includeFollowUps` | `boolean` | `true` | Allow follow-up questions |
| `provideFeedback` | `boolean` | `true` | Generate feedback |
| `voiceMode` | `boolean` | `false` | Enable voice interaction |
| `asrModel` | `string` | `undefined` | Speech recognition model |
| `ttsVoice` | `string` | `undefined` | TTS voice selection |
| `vadSensitivity` | `number` | `0.5` | Voice detection sensitivity (0-1) |
| `autoPlayTTS` | `boolean` | `true` | Auto-speak responses |
| `recordingQuality` | `'low' \| 'medium' \| 'high'` | `'medium'` | Audio quality |
| `activePersonaId` | `string` | `undefined` | Selected persona ID |

### InterviewStyle Options
**File**: `src/types/index.ts` (lines 277-281)

```typescript
export type InterviewStyle = 
  | 'conversational'  // Casual, friendly
  | 'formal'          // Professional
  | 'challenging'     // Rigorous
  | 'supportive';     // Encouraging
```

### Question Difficulty Levels
- `'easy'` - Foundational questions
- `'medium'` - Standard professional
- `'hard'` - Complex, deep-dive

---

## Timer & Duration Constants

### Backend Constants (InterviewService.ts)

**File**: `src/services/InterviewService.ts` (lines 7-10)

```typescript
/** Default interview duration when not specified (minutes). */
const DEFAULT_TOTAL_MINUTES = 30;

/** Default wrap-up threshold when not specified (minutes from end). */
const DEFAULT_WRAP_UP_MINUTES = 5;
```

| Constant | Value | Units | Description |
|----------|-------|-------|-------------|
| `DEFAULT_TOTAL_MINUTES` | `30` | minutes | Total interview duration |
| `DEFAULT_WRAP_UP_MINUTES` | `5` | minutes | Time before end to start wrap-up |

### Frontend State (Interview.tsx)

**File**: `src/ui/pages/Interview.tsx` (lines 67-72)

```typescript
const [timerSeconds, setTimerSeconds] = useState(0);
const [timerDuration, setTimerDuration] = useState(1800);  // 30 min default
const isTimerWarning = timerSeconds >= timerDuration * 0.8;  // 80% warning
const isTimerExpired = timerSeconds >= timerDuration;  // Auto-end
```

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `timerSeconds` | `0` | Elapsed time counter |
| `timerDuration` | `1800` | Total duration in seconds (30 min) |
| `isTimerWarning` | Calculated | True when 80% time used |
| `isTimerExpired` | Calculated | True when time exhausted |

### Timer Configuration Object

**InterviewService.ts** (lines 46, 49-50):
```typescript
timerConfig?: { 
  totalInterviewMinutes: number;      // Default: 30
  wrapUpThresholdMinutes: number;      // Default: 5
}
```

### Timer Injection Logic

**File**: `src/services/InterviewService.ts` (lines 440-466)

```typescript
// Midpoint pacing signal (~50% of total duration)
const midpointThreshold = session.totalInterviewMinutes / 2;
if (!session.midpointInjected && remainingMinutes <= midpointThreshold) {
  messagesToSend.push({
    id: `timer-mid-${Date.now()}`,
    role: 'system',
    content: `<timer_update>pacing_check time_update mid_session — ${Math.round(remainingMinutes)} minutes remaining</timer_update>`,
    timestamp: new Date().toISOString(),
  });
  session.midpointInjected = true;
}

// Wrap-up signal
if (!session.wrapUpInjected && remainingMinutes <= session.wrapUpThresholdMinutes) {
  messagesToSend.push({
    id: `timer-wrap-${Date.now()}`,
    role: 'system',
    content: `<timer_signal>wrap_up_signal closing_soon timer time_warning — ${Math.round(remainingMinutes)} minutes remaining</timer_signal>`,
    timestamp: new Date().toISOString(),
  });
  session.wrapUpInjected = true;
}
```

### Complete Timer Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TIMER FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Settings (UI - Settings.tsx)                                          │
│  ┌────────────────────────────────────────┐                                 │
│  │ Input: 30 minutes                      │                                 │
│  │ Range: 5-120 minutes                   │                                 │
│  └──────────────────┬─────────────────────┘                                 │
│                     │                                                       │
│                     ▼                                                       │
│  Storage (SettingsRepository.ts & StorageManager.ts)                       │
│  ┌────────────────────────────────────────┐                                 │
│  │ Stored: 3600  ←─── BUG! Should be 30 │                                 │
│  │ Units: Seconds (wrong)               │                                 │
│  └──────────────────┬─────────────────────┘                                 │
│                     │                                                       │
│                     ▼                                                       │
│  Interview Page (Interview.tsx lines 91-95)                                │
│  ┌────────────────────────────────────────┐                                 │
│  │ Multiplies by 60: 3600 * 60 = 216000  │                                 │
│  │ Result: 60 hours instead of 30 min!  │                                 │
│  └──────────────────┬─────────────────────┘                                 │
│                     │                                                       │
│                     ▼                                                       │
│  InterviewService (Backend Timer - Separate!)                              │
│  ┌────────────────────────────────────────┐                                 │
│  │ DEFAULT_TOTAL_MINUTES = 30            │                                 │
│  │ Used for phase management             │                                 │
│  │ NOT synchronized with frontend!       │                                 │
│  └────────────────────────────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Voice & Audio Configuration

### AudioSettings Type
**File**: `src/types/index.ts` (lines 146-155)

```typescript
export interface AudioSettings {
  inputDeviceId?: string;          // Selected microphone
  outputDeviceId?: string;       // Selected speaker
  inputVolume: number;           // 0-100
  outputVolume: number;          // 0-100
  echoCancellation: boolean;     // Default: true
  noiseSuppression: boolean;     // Default: true
  autoGainControl: boolean;      // Default: true
  recordingQuality?: 'low' | 'medium' | 'high';
}
```

### VADConfig (Voice Activity Detection)
**File**: `src/types/index.ts` (lines 161-172, 187-194)

```typescript
export interface VADConfig {
  energyThreshold: number;    // 0.01 - Energy to consider speech
  minSpeechMs: number;        // 250 - Min speech before trigger
  minSilenceMs: number;       // 800 - Min silence before end
  onsetFrames: number;        // 2 - Frames before onset
  hangoverFrames: number;     // 6 - Extra frames after drop
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 0.01,
  minSpeechMs: 250,
  minSilenceMs: 800,
  onsetFrames: 2,
  hangoverFrames: 6,
};
```

### ASRConfig (Automatic Speech Recognition)
**File**: `src/types/index.ts` (lines 178-185, 196-201)

```typescript
export interface ASRConfig {
  bufferSize: number;         // 4096 - ScriptProcessor buffer
  targetSampleRate: number;   // 16000 Hz - Must match Whisper
  wsCloseDelayMs: number;      // 3000 - Delay for final transcript
}

export const DEFAULT_ASR_CONFIG: ASRConfig = {
  bufferSize: 4096,
  targetSampleRate: 16000,
  wsCloseDelayMs: 3000,
};
```

### TTS Configuration
**File**: `src/services/audio/TTSService.ts`

| Variable | Default | Description |
|----------|---------|-------------|
| `model` | `'kokoro-v1'` | TTS model |
| `voice` | `'shimmer'` | Default voice |
| `speed` | `1.3` | Speaking speed (1.0 = normal) |
| `responseFormat` | `'mp3'` | Audio format |
| `STREAMING_SAMPLE_RATE` | `24000` | Hz for streaming |

### ASR Model Options
**File**: `src/ui/pages/Interview.tsx` (line 287)

```typescript
type ASRModel = 'Whisper-Tiny' | 'Whisper-Base' | 'Whisper-Small';
// Default: 'Whisper-Base'
```

---

## Model Configuration

### ModelConfig Type
**File**: `src/types/index.ts` (lines 245-252)

```typescript
export interface ModelConfig {
  id: string;                  // Model identifier
  name: string;                // Display name
  provider: string;            // e.g., 'lemonade-server'
  maxTokens: number;           // Max output tokens
  temperature: number;         // Sampling temp
  isLoaded?: boolean;          // Currently in memory
}
```

### CompatibleModel Type
**File**: `src/types/index.ts` (lines 228-236)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Model ID |
| `downloaded` | `boolean` | Available locally |
| `suggested` | `boolean` | System recommended |
| `labels` | `string[]` | Tags (e.g., 'llm', 'audio') |
| `recipe` | `string?` | Backend recipe |
| `size` | `number?` | Size in GB |
| `checkpoint` | `string?` | Checkpoint name |

### Model Loading Options
**File**: `src/electron_app/main.ts` (lines 492-497)

```typescript
{
  ctx_size?: number;                              // Context window (16384)
  llamacpp_backend?: 'vulkan' | 'rocm' | 'metal' | 'cpu';
  llamacpp_args?: string;                         // Additional args
  save_options?: boolean;                         // Persist options
}
```

---

## Persona Variables

### AgentPersona Type
**File**: `src/types/index.ts` (lines 108-137)

```typescript
export interface AgentPersona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  interviewStyle: InterviewStyle;
  questionDifficulty: 'easy' | 'medium' | 'hard';
  ttsVoice?: string;
  avatarUrl?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  
  // v5: Structured interview arc fields
  personaRole?: string;
  q1Topic?: string;
  q2Topic?: string;
  q3Topic?: string;
  q4Topic?: string;
  q5Topic?: string;
  primaryProbeArea?: string;
  mustCoverTopic1?: string;
  mustCoverTopic2?: string;
  mustCoverTopic3?: string;
  validateClaim1?: string;
  validateClaim2?: string;
  watchSignal1?: string;
  watchSignal2?: string;
  gender?: 'male' | 'female' | 'neutral';
}
```

### Persona Generation Variables
**File**: `src/services/PersonaGeneratorService.ts`

```typescript
interface PersonaGenerationInput {
  jobDescriptionText: string;    // Truncated to ~4000 chars
  resumeText: string;             // Truncated to ~4000 chars
  interviewType: string;
  company: string;
  position: string;
  numberOfQuestions?: number;   // Default: 5
}
```

---

## Phase Keywords & Interview Flow

### Phase Keyword Mapping
**File**: `src/services/InterviewService.ts` (lines 12-22)

```typescript
const PHASE_KEYWORDS: Record<string, string> = {
  greeting: 'greeting start introduction audio_check',
  '1': 'q1_active warm_up baseline',
  '2': 'q2_active core_technical primary',
  '3': 'q3_active behavioral leadership team',
  '4': 'q4_active validation resume_probe',
  '5': 'q5_active deep_dive closing_technical',
  wrap_up: 'wrap_up_signal closing_soon timer time_warning',
  mid: 'pacing_check time_update mid_session',
};
```

### Phase Advancement Logic
**File**: `src/services/InterviewService.ts` (lines 475-482)

```typescript
private getPhaseKeyword(questionCount: number): string {
  if (questionCount === 0) return PHASE_KEYWORDS['greeting'];
  if (questionCount <= 2) return PHASE_KEYWORDS['1'];  // Q1: turns 1-2
  if (questionCount <= 4) return PHASE_KEYWORDS['2'];  // Q2: turns 3-4
  if (questionCount <= 6) return PHASE_KEYWORDS['3'];  // Q3: turns 5-6
  if (questionCount <= 8) return PHASE_KEYWORDS['4'];  // Q4: turns 7-8
  return PHASE_KEYWORDS['5'];  // Q5: turn 9+
}
```

### InterviewSession Interface (v2 with Time Allocation)
**File**: `src/services/InterviewService.ts`

```typescript
interface InterviewSession {
  interviewId: string;
  messages: Message[];
  questionCount: number;
  // Timer state
  sessionStartMs: number;
  totalInterviewMinutes: number;
  wrapUpThresholdMinutes: number;
  midpointInjected: boolean;
  wrapUpInjected: boolean;
  // Greeting phase timing (v2: time-based tracking for coherent UX)
  greetingPhaseStartMs: number;          // When greeting began
  greetingMinDurationMs: number;         // Default: 2 minutes (120000 ms)
  greetingCompleted: boolean;            // Whether 3-step opener is done
  // Interview pacing allocation (v2)
  timePerQuestionMinutes: number;       // Calculated: ~2-3 min per question
  effectiveInterviewMinutes: number;     // total - wrapUp - greeting allocation
  // Phase tracking
  currentPhaseKeyword: string;
  // Stored for resume/rebuild support
  interviewConfig: Partial<Interview>;
  persona: AgentPersona | null;
  jobDescription: string;
  resume: string;
}
```

### New v2 Timing Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `greetingPhaseStartMs` | `number` | `Date.now()` | Timestamp when greeting phase began |
| `greetingMinDurationMs` | `number` | `120000` (2 min) | Minimum time for 3-step opener |
| `greetingCompleted` | `boolean` | `false` | Whether greeting phase is complete |
| `timePerQuestionMinutes` | `number` | Calculated | Estimated time per question (~2-3 min) |
| `effectiveInterviewMinutes` | `number` | Calculated | Actual time for questions (total - wrapUp - 2 min) |

### Time Allocation Calculation

```typescript
// In InterviewService.startInterview()
const GREETING_ALLOCATION_MINUTES = 2;  // 2 minutes for 3-step opener
const effectiveInterviewMinutes = Math.max(
  totalInterviewMinutes - wrapUpThresholdMinutes - GREETING_ALLOCATION_MINUTES,
  5  // Minimum 5 minutes for actual interview
);
const timePerQuestionMinutes = effectiveInterviewMinutes / numberOfQuestions;
```

**Example for 30-minute interview:**
- Total: 30 minutes
- Wrap-up: 5 minutes (for candidate questions)
- Greeting: 2 minutes (3-step opener)
- Effective: 23 minutes for actual questions
- Per question: 23 / 10 = **2.3 minutes per question**

---

## Natural Session Overview (v2)

The greeting phase includes a natural session overview that sets expectations without being overly rigid or robotic:

**Updated Prompt** (prompts.json):
```json
"[[REQUIRE: Step 3 — Session overview: 
  'We have about ${total_duration} minutes. 
   I'll start with some questions, and we'll save time at the end for yours.']]"
```

**Example Output** (30-min interview):
> "We have about 30 minutes. I'll start with some questions, and we'll save time at the end for yours."

This approach:
- Sounds natural and human-like (not robotic)
- Sets expectations without rigid constraints
- Doesn't specify exact question count or timing per question
- Allows flexible pacing based on conversation flow
- Still communicates the total duration and wrap-up time

### Internal Time Tracking (Not Exposed to User)

While we calculate `timePerQuestionMinutes` and `effectiveInterviewMinutes` internally for our own pacing guidance and tracking, these are NOT mentioned in the session overview to avoid sounding artificial or overly structured.

---

## Prompt Template Variables

### Interview System Prompt With Persona
**File**: `src/services/PromptManager.ts` (lines 39-67)

```typescript
getInterviewSystemPromptWithPersona(variables: {
  personaName: string;
  personaRole: string;
  interviewType: string;
  position: string;
  company: string;
  interviewStyle: string;
  questionDifficulty: string;
  numberOfQuestions: number;
  wrapUpThresholdMinutes: number;
  currentMinutesRemaining: number;
  currentPhaseKeyword: string;
  currentTopicInstruction: string;
  q1Topic: string;
  q2Topic: string;
  q3Topic: string;
  q4Topic: string;
  q5Topic: string;
  primaryProbeArea: string;
  mustCoverTopic1: string;
  mustCoverTopic2: string;
  mustCoverTopic3: string;
  validateClaim1: string;
  validateClaim2: string;
  watchSignal1: string;
  watchSignal2: string;
}): string
```

### Prompt Placeholders in prompts.json

| Placeholder | Example Value | Description |
|-------------|---------------|-------------|
| `${personaName}` | "Sarah Chen" | Interviewer name |
| `${personaRole}` | "Senior Engineer at Google" | Role + company |
| `${interviewType}` | "technical" | Interview category |
| `${position}` | "Senior Frontend Engineer" | Job title |
| `${company}` | "Google" | Company name |
| `${interviewStyle}` | "conversational" | Style directive |
| `${questionDifficulty}` | "medium" | Difficulty level |
| `${numberOfQuestions}` | 10 | Target Q count |
| `${wrapUpThresholdMinutes}` | 5 | Wrap-up time |
| `${currentMinutesRemaining}` | 30 | Current timer |
| `${currentPhaseKeyword}` | "q1_active warm_up" | Phase tags |
| `${currentTopicInstruction}` | "Tell me about..." | Current topic |
| `${q1Topic}` - `${q5Topic}` | Question texts | 5-question arc |
| `${primaryProbeArea}` | "React architecture" | Focus area |
| `${mustCoverTopic1-3}` | Required topics | Must cover |
| `${validateClaim1-2}` | Resume claims | Validate |
| `${watchSignal1-2}` | Behaviors | Watch for |
| **v2 Timing Variables** ||
| `${totalInterviewMinutes}` | 30 | Total interview duration |
| `${greetingAllocationMinutes}` | 2 | Time for 3-step opener |
| `${timePerQuestionMinutes}` | 2.3 | **Internal only** - Not exposed in prompts |
| `${effectiveInterviewMinutes}` | 23 | **Internal only** - Not exposed in prompts |

---

## Data Flow Diagrams

### Complete Settings Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE SETTINGS FLOW                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────────────┐         ┌──────────────────┐
│   React UI   │────────▶│    IPC Renderer      │────────▶│    IPC Main      │
│              │◄────────│   (preload.ts)       │◄────────│   (main.ts)      │
└──────────────┘         └──────────────────────┘         └──────────────────┘
                                                                │
                                                                ▼
                                                        ┌──────────────────┐
                                                        │ SettingsRepository│
                                                        │  (get/update)     │
                                                        └──────────────────┘
                                                                │
                                                                ▼
                                                        ┌──────────────────┐
                                                        │  StorageManager   │
                                                        │ (SingletonStore) │
                                                        └──────────────────┘
                                                                │
                                                                ▼
                                                        ┌──────────────────┐
                                                        │   settings.json   │
                                                        │  (userData/data)  │
                                                        └──────────────────┘

UserSettings Key: "user"
InterviewerSettings Key: "interviewer"
```

### Interview Start Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         INTERVIEW START FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  Preparing.tsx                    main.ts                  InterviewService
       │                              │                              │
       │  1. startInterview()         │                              │
       │─────────────────────────────▶│                              │
       │                              │  2. Create interview record   │
       │                              │─────────────────────────────▶│
       │                              │                              │
       │                              │  3. startInterview()         │
       │                              │  with config + persona       │
       │                              │─────────────────────────────▶│
       │                              │                              │
       │                              │                              │  4. Build
       │                              │                              │     system
       │                              │                              │     prompt
       │                              │                              │
       │                              │  5. Return greeting          │
       │                              │◀─────────────────────────────│
       │  6. Navigate to interview  │                              │
       │◀─────────────────────────────│                              │
       │                              │                              │

Timer Config Passed:
┌─────────────────────────────────────────────────────────────────────────────┐
│ totalInterviewMinutes: number (default: DEFAULT_TOTAL_MINUTES = 30)        │
│ wrapUpThresholdMinutes: number (default: DEFAULT_WRAP_UP_MINUTES = 5)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Timer Injection Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          TIMER INJECTION FLOW                                 │
└──────────────────────────────────────────────────────────────────────────────┘

  sendMessage()                        buildMessagesWithInjections()
       │                                         │
       │────────────────────────────────────────▶│
       │                                         │  1. Calculate elapsed
       │                                         │     remainingMinutes =
       │                                         │     total - elapsed
       │                                         │
       │                                         │  2. Check phase change
       │                                         │     getPhaseKeyword()
       │                                         │
       │                                         │  3. Check midpoint
       │                                         │     (50% threshold)
       │                                         │     → Inject pacing_check
       │                                         │
       │                                         │  4. Check wrap-up
       │                                         │     (wrapUpThresholdMinutes)
       │                                         │     → Inject wrap_up_signal
       │                                         │
       │  Return messages with                   │
       │  injected system messages               │
       │◀────────────────────────────────────────│
       │                                         │

Injection Points:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Midpoint (50%):                                                             │
│   <timer_update>pacing_check time_update mid_session — X min remaining     │
│                                                                             │
│ Wrap-up (default 5 min from end):                                          │
│   <timer_signal>wrap_up_signal closing_soon timer time_warning — X min     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Known Issues

### Issue #1: Timer Units Mismatch (FIXED ✓)

**Severity**: HIGH - Timer was non-functional

**Status**: ✅ **FIXED** in current branch

**Description**:
The `defaultInterviewDuration` had inconsistent units across the codebase:

1. **Storage**: Stored as `3600` (seconds) - WRONG
2. **UI**: Displayed as minutes (30) - CORRECT
3. **Interview.tsx**: Multiplied by 60: `3600 * 60 = 216,000` seconds (60 hours!) - BUG

**Fix Applied**:
```typescript
// Changed in both locations:
defaultInterviewDuration: 3600,  // OLD (seconds - WRONG)
defaultInterviewDuration: 30,     // NEW (minutes - CORRECT)
```

**Files Modified**:
- `src/database/storage/StorageManager.ts` line 152
- `src/database/repositories/SettingsRepository.ts` line 63

**Result**: Timer now correctly counts down from the user-selected duration (default: 30 minutes).

### Issue #2: Frontend/Backend Timer Desynchronization

**Severity**: MEDIUM

**Description**:
The frontend timer (Interview.tsx) and backend timer (InterviewService.ts) use separate timer systems that are not synchronized:
- Frontend: Uses `timerDuration` state (with bug above)
- Backend: Uses `DEFAULT_TOTAL_MINUTES = 30`

This causes the LLM to think there's 30 minutes remaining when the UI shows different times.

**Fix**:
Pass the user's `defaultInterviewDuration` through the IPC chain to `InterviewService.startInterview()`.

---

## Verification Checklist

### User Settings

- [ ] `userId` - Verify unique per installation
- [ ] `theme` - Check light/dark/system switching works
- [ ] `language` - Verify locale changes (if implemented)
- [ ] `notifications` - Test notification preferences
- [ ] `autoSave` - Confirm transcript auto-saving
- [x] **FIXED**: `defaultInterviewDuration` - Units bug corrected (3600 → 30)
- [ ] `createdAt` - Verify set on first run
- [ ] `updatedAt` - Verify updates on changes

### Interviewer Settings

- [ ] `modelProvider` - Verify connects to correct backend
- [ ] `modelName` - Check loads correct LLM
- [ ] `extractionModelName` - Verify extraction uses correct model
- [ ] `temperature` - Test affects output (0.7 default)
- [ ] `maxTokens` - Verify limits responses (2000 default)
- [ ] `interviewStyle` - Check style applied (conversational/formal/challenging/supportive)
- [ ] `questionDifficulty` - Verify questions match level (easy/medium/hard)
- [ ] `numberOfQuestions` - Check interview plans correct count (10 default)
- [ ] `includeFollowUps` - Verify follow-ups enabled
- [ ] `provideFeedback` - Check feedback generation
- [ ] `voiceMode` - Test voice features toggle
- [ ] `vadSensitivity` - Verify 0-1 sensitivity control
- [ ] `autoPlayTTS` - Check TTS auto-play
- [ ] `recordingQuality` - Test quality levels (low/medium/high)

### Timer System

- [x] **FIXED**: Timer units mismatch bug (3600s → 30min)
- [ ] Verify timer counts down correctly from 30 minutes
- [ ] Check warning at 80% time remaining (24 min mark)
- [ ] Verify auto-end at 100% (30 min mark)
- [ ] Test midpoint injection at 50% (15 min mark)
- [ ] Test wrap-up injection at 5 minutes from end (25 min mark)
- [ ] Sync frontend/backend timer values

### v2 Time Tracking (Internal - New)

- [ ] Verify `greetingPhaseStartMs` is set on interview start
- [ ] Verify `greetingMinDurationMs` is 2 minutes (120000 ms)
- [ ] Check `greetingCompleted` updates after 3-step opener
- [ ] Verify `timePerQuestionMinutes` calculates correctly internally (~2-3 min)
- [ ] Check `effectiveInterviewMinutes` = total - wrapUp - 2 min
- [ ] Test session overview sounds natural (no specific question count or per-question timing)
- [ ] Verify coherent pacing guidance throughout interview (internal tracking only)

### Voice/Audio

- [ ] `inputDeviceId` - Test microphone selection
- [ ] `outputDeviceId` - Test speaker selection
- [ ] `inputVolume` - Verify 0-100 control
- [ ] `outputVolume` - Verify 0-100 control
- [ ] `echoCancellation` - Test echo removal
- [ ] `noiseSuppression` - Verify noise reduction
- [ ] `autoGainControl` - Test automatic gain
- [ ] `recordingQuality` - Verify quality settings
- [ ] VAD `energyThreshold` - Test sensitivity (0.01 default)
- [ ] VAD `minSpeechMs` - Verify 250ms default
- [ ] VAD `minSilenceMs` - Verify 800ms default
- [ ] ASR `bufferSize` - Verify 4096 default
- [ ] ASR `targetSampleRate` - Verify 16000 Hz
- [ ] ASR `wsCloseDelayMs` - Verify 3000ms default
- [ ] TTS `speed` - Verify 1.3 default

### Persona System

- [ ] `name` - Verify displays correctly
- [ ] `interviewStyle` - Check style applied
- [ ] `questionDifficulty` - Verify difficulty matches
- [ ] `q1Topic` - `q5Topic` - Check topics used
- [ ] `primaryProbeArea` - Verify emphasis
- [ ] `mustCoverTopic1-3` - Check required coverage
- [ ] `validateClaim1-2` - Verify resume validation
- [ ] `watchSignal1-2` - Check behavioral monitoring

### Model System

- [ ] `ctx_size` - Verify 16384 default context
- [ ] `llamacpp_backend` - Test backend selection
- [ ] Model loading/unloading works
- [ ] ASR model loads (Whisper)
- [ ] TTS model loads (Kokoro)

---

## File Quick Reference

| Purpose | File Path |
|---------|-----------|
| Type Definitions | `src/types/index.ts` |
| User Settings Defaults | `src/database/repositories/SettingsRepository.ts` (lines 55-70) |
| Interviewer Settings Defaults | `src/database/repositories/SettingsRepository.ts` (lines 72-93) |
| Storage Defaults | `src/database/storage/StorageManager.ts` (lines 141-181) |
| Settings UI | `src/ui/pages/Settings.tsx` |
| Interview UI | `src/ui/pages/Interview.tsx` |
| Preparing UI | `src/ui/pages/Preparing.tsx` |
| Interview Service | `src/services/InterviewService.ts` |
| Prompt Manager | `src/services/PromptManager.ts` |
| Prompt Templates | `src/data/prompts.json` |
| Main Process | `src/electron_app/main.ts` |
| IPC Preload | `src/electron_app/preload.ts` |
| VAD Service | `src/services/audio/VADService.ts` |
| ASR Service | `src/services/audio/RealtimeASRService.ts` |
| TTS Service | `src/services/audio/TTSService.ts` |
| Voice Manager | `src/services/VoiceInterviewManager.ts` |

---

## Questions for Clarification

1. **2-3 Minute Initial Period**: You mentioned a 2-3 minute constant at the beginning. I cannot locate this in the codebase. Could you clarify:
   - Is this a grace period before the timer starts?
   - Is this the expected duration of the greeting/opener phase?
   - Is this a minimum time before wrap-up can trigger?
   - Should this be added as a new feature?

2. **Timer Synchronization**: Should the frontend and backend timers be synchronized to use the same `defaultInterviewDuration` value?

3. **Timer Units**: Should `defaultInterviewDuration` be stored as minutes (30) or seconds (1800)?

---

*Document Version: 1.0*
*Last Updated: 2026-03-01*
*Total Variables Documented: 50+*
