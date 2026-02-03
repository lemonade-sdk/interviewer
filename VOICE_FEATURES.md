# Voice Features Implementation Guide

## 🎤 Overview

The AI Interviewer now supports **full voice interaction** with:
- **ASR (Automatic Speech Recognition)** - Voice to text
- **VAD (Voice Activity Detection)** - Automatic turn detection
- **TTS (Text-to-Speech)** - AI responses as speech
- **Multiple Agent Personas** - Different interviewer personalities
- **Audio Device Management** - Select microphone/speakers
- **Complete Audio Tracking** - Full conversation history with audio files

## 🏗️ Architecture

### New Folder Structure

```
src/
├── services/
│   ├── audio/
│   │   ├── AudioService.ts      # Mic/speaker management
│   │   ├── ASRService.ts        # Speech-to-text (Lemonade Server)
│   │   ├── VADService.ts        # Voice activity detection
│   │   └── TTSService.ts        # Text-to-speech
│   └── VoiceInterviewManager.ts # Orchestrates voice interviews
├── database/
│   └── repositories/
│       └── PersonaRepository.ts # Agent persona management
```

### Database Schema Updates

**New Tables:**
- `agent_personas` - Store interviewer personas
- `audio_recordings` - Track audio files
- `audio_settings` - Audio device preferences

**Updated Tables:**
- `interviewer_settings` - Added voice options

## 🎯 Features Implemented

### 1. Agent Personas

Create multiple interviewer personalities:

```typescript
interface AgentPersona {
  name: string;
  description: string;
  systemPrompt: string; // Custom AI instructions
  interviewStyle: 'conversational' | 'formal' | 'challenging' | 'supportive';
  questionDifficulty: 'easy' | 'medium' | 'hard';
  ttsVoice?: string; // Voice selection
  isDefault: boolean;
}
```

**Default Personas:**
- **Professional Interviewer** - Balanced, practical focus
- **Senior Tech Lead** - Deep technical, challenging questions
- **Friendly Mentor** - Supportive, encouraging approach

### 2. Voice Workflow

```
User clicks "Start Voice Interview"
         ↓
    VAD starts listening
         ↓
User speaks → VAD detects speech start
         ↓
    Audio recording begins
         ↓
User stops → VAD detects silence (1 sec)
         ↓
    Recording stops
         ↓
    Audio sent to ASR (Lemonade Server)
         ↓
    Text transcript received
         ↓
    Text sent to LLM
         ↓
    AI response generated
         ↓
    Response sent to TTS
         ↓
    Audio played back
         ↓
    Loop continues...
```

### 3. Audio Services

#### AudioService
- Enumerates microphones/speakers
- Records audio with quality settings
- Plays audio with device selection
- Real-time audio level monitoring

#### ASRService
- Uses Lemonade Server `/api/v1/audio/transcriptions`
- Supports multiple languages
- Returns transcript with confidence scores

#### VADService
- Detects speech start/end automatically
- Adjustable sensitivity (0-1)
- Emits events for speech detection
- Tracks speech/silence duration

#### TTSService
- Uses Web Speech API
- Multiple voice selection
- Adjustable rate, pitch, volume
- Async playback with promises

### 4. Enhanced Message Tracking

```typescript
interface Message {
  // ... existing fields
  audioFile?: string;        // Path to user's audio
  asrTranscript?: string;    // Raw ASR output
  ttsAudioFile?: string;     // Generated TTS audio
  agentPersonaId?: string;   // Active persona
  vadMetadata?: VADMetadata; // Voice detection data
  audioDeviceId?: string;    // Recording device
}
```

### 5. Settings

New voice-related settings:
- Voice mode enable/disable
- ASR model selection
- TTS voice selection
- VAD sensitivity slider
- Auto-play TTS toggle
- Recording quality (low/medium/high)
- Active persona selection

## 🚀 Usage

### Starting a Voice Interview

```typescript
// 1. Select persona
const persona = await personaRepository.findById('senior-tech-lead');

// 2. Configure voice settings
settings.voiceMode = true;
settings.activePersonaId = persona.id;
settings.vadSensitivity = 0.7;

// 3. Start interview
const interview = await startInterview({
  title: 'Voice Interview Test',
  company: 'Tech Corp',
  position: 'Senior Engineer',
  interviewType: 'technical',
});

// 4. Voice interaction happens automatically
```

### Managing Personas

```typescript
// Create custom persona
const persona = await personaRepository.create({
  name: 'Startup CTO',
  description: 'Fast-paced, entrepreneurial interviewer',
  systemPrompt: 'You are a startup CTO...',
  interviewStyle: 'challenging',
  questionDifficulty: 'hard',
  ttsVoice: 'Google US English',
});

// Set as default
await personaRepository.setDefault(persona.id);
```

### Audio Device Management

```typescript
// Get devices
const { inputs, outputs } = await audioService.getAudioDevices();

// Select device
audioSettings.inputDeviceId = inputs[0].deviceId;
audioSettings.outputDeviceId = outputs[0].deviceId;

// Apply settings
audioService.updateSettings(audioSettings);
```

## 📊 Conversation History

Full audit trail includes:
- Original audio files (user speech)
- ASR transcripts (what was recognized)
- LLM responses (AI text)
- TTS audio files (generated speech)
- Persona used for each turn
- VAD metadata (speech patterns)
- Audio device information

## 🎛️ Configuration

### Voice Settings Location

**Settings → Interviewer AI → Voice Options**
- Toggle voice mode
- Select ASR model
- Choose TTS voice
- Adjust VAD sensitivity
- Set recording quality

**Settings → Audio Devices**
- Select microphone
- Select speakers
- Test devices
- Adjust volumes

**Settings → Personas**
- Browse available personas
- Create custom personas
- Edit system prompts
- Set default persona

## 🔧 Technical Details

### ASR via Lemonade Server

```javascript
POST http://localhost:8000/api/v1/audio/transcriptions
Content-Type: multipart/form-data

{
  file: <audio blob>,
  model: 'whisper',
  language: 'en'
}

Response:
{
  text: "transcribed text here",
  confidence: 0.95,
  segments: [...]
}
```

### VAD Algorithm

Uses Web Audio API frequency analysis:
1. Analyze audio energy every 50ms
2. Compare to threshold (based on sensitivity)
3. Detect speech start when energy > threshold
4. Detect speech end after 1 second of silence
5. Emit events for UI updates

### TTS Implementation

Uses browser's Web Speech API:
- No external dependencies
- Multiple voices supported
- Works offline
- Adjustable parameters

## 🎨 UI Components

### Interview Page Updates

New voice controls:
- 🎤 **Voice Mode Toggle** - Switch between text/voice
- ⏺️ **Recording Indicator** - Shows when listening
- 🔊 **Audio Level Meter** - Visual feedback
- 👤 **Active Persona Display** - Shows current interviewer
- ⏸️ **Pause/Resume** - Control voice interaction

### Persona Selector

- Grid view of available personas
- Preview persona details
- Quick switch during interview
- Create/edit personas

### Audio Settings Panel

- Device dropdowns with test buttons
- Volume sliders with real-time preview
- Echo cancellation toggles
- Recording quality selector

## 🚦 Status Indicators

- 🟢 **Green** - Listening for speech
- 🔴 **Red** - Recording active
- 🔵 **Blue** - Processing (ASR/LLM/TTS)
- ⚪ **Gray** - Idle/text mode

## 📝 Todo: Next Steps

To fully complete voice features:

1. **UI Integration** (In Progress)
   - Add voice controls to Interview page
   - Create persona selection modal
   - Build audio device settings panel
   - Add visual audio level meters

2. **File Storage**
   - Implement audio file saving to disk
   - Link audio files to messages
   - Cleanup old recordings

3. **Error Handling**
   - Graceful fallback to text mode
   - Clear error messages
   - Retry logic for ASR/TTS

4. **Performance**
   - Audio compression
   - Background processing
   - Memory management

5. **Testing**
   - Test on various devices
   - Verify cross-browser compatibility
   - Performance benchmarking

## 🔒 Privacy

All voice processing happens:
- **ASR**: Local via Lemonade Server
- **TTS**: Local via browser API
- **Audio files**: Stored locally only
- **No cloud uploads**: Complete privacy

## 📚 Resources

- Lemonade Server audio docs
- Web Audio API documentation
- Web Speech API reference
- MediaStream Recording API

---

**Voice-enabled interviews provide the most realistic practice experience!** 🎤🤖
