# 🏛️ Interviewer Flow and Architecture

Below are the architectural graphs for each phase of the application, detailing what the user sees on the frontend compared to what happens in the backend.

## 🛬 1. Landing Phase

**User View:** The user uploads a resume and job description. They see a form to review AI-extracted details (title, company, position, interview type) and click "Begin".
**Backend:** The Electron API parses the uploaded documents, triggers an extraction service to find details, and checks if the Lemonade Server is running.

```mermaid
graph TD
    subgraph frontend ["User Interface (Landing)"]
        A["Upload Resume & Job Post"] --> B["View Extraction Progress"]
        B --> C["Review Form Details"]
        C --> D["Click Begin"]
    end
    
    subgraph backend ["Backend (Electron / Services)"]
        A_backend["Parse Documents to Base64"]
        B_backend["Extract Company, Position, Title"]
        C_backend["Check Lemonade Server Status"]
        
        A --> A_backend
        A_backend --> B_backend
        B_backend --> B
        D --> C_backend
    end
```

## ⚙️ 2. Preparing Phase

**User View:** The user reviews their resume text/PDF, selects an LLM model, configures interview preferences (style, difficulty), and sees detailed progress states for model downloads, loading, and persona generation.
**Backend:** Fetches existing documents, pulls/loads LLM/ASR/TTS models into memory (optimizing context window). Prompts the LLM API to generate a custom interviewer persona based on the resume and job description. Creates the interview session in the DB.

```mermaid
graph TD
    subgraph frontend ["User Interface (Preparing Phase)"]
        UI_Init["1. Mount: Request Data & Models"]
        UI_ShowData["2. Render: Resume PDF/Text & Model List"]
        UI_UserAction["3. User Selects: Model, Style, Difficulty"]
        UI_ClickStart["4. User Clicks 'Start Interview'"]
        
        UI_WaitLLM["5. Show 'Downloading/Loading LLM' Progress"]
        UI_WaitVoice["6. Show 'Preparing voice features' Progress"]
        UI_WaitPersona["7. Show 'Crafting interviewer persona' Progress"]
        
        UI_Navigate["8. Navigate to Interview Screen"]
    end
    
    subgraph backend ["Backend (Electron IPC / Services)"]
        BE_GetData["IPC: document:getFileData & document:get"]
        BE_GetModels["IPC: model:listAll (Filter LLM candidates)"]
        
        BE_CheckHealth["IPC: server:getHealth (Check loaded models)"]
        
        BE_PullLLM["IPC: model:pullStreaming (Emit SSE Progress)"]
        BE_LoadLLM["IPC: model:load (Optimize ctx_size: 16384, backend: vulkan)"]
        
        BE_PrepVoice["Load/Pull Whisper ASR & Kokoro TTS models"]
        BE_SaveConfig["IPC: settings:updateInterviewer"]
        
        BE_GenPersona["IPC: persona:generate<br>1. Job Analysis<br>2. Resume Analysis<br>3. Craft Agent Persona"]
        BE_CallLLM["LemonadeClient: Call LLM API to generate Persona"]
        BE_SavePersona["PersonaRepository: Save to DB"]
        
        BE_StartSession["IPC: interview:start (Create DB Session)"]
    end
    
    %% Initial Load Flow
    UI_Init --> BE_GetData
    UI_Init --> BE_GetModels
    BE_GetData --> UI_ShowData
    BE_GetModels --> UI_ShowData
    
    %% User Action Flow
    UI_ShowData --> UI_UserAction
    UI_UserAction --> UI_ClickStart
    
    %% Model Provisioning Flow
    UI_ClickStart --> BE_CheckHealth
    BE_CheckHealth --> UI_WaitLLM
    
    UI_WaitLLM --> BE_PullLLM
    BE_PullLLM --> BE_LoadLLM
    
    BE_LoadLLM --> UI_WaitVoice
    UI_WaitVoice --> BE_PrepVoice
    BE_PrepVoice --> BE_SaveConfig
    
    %% Persona Generation Flow
    BE_SaveConfig --> UI_WaitPersona
    UI_WaitPersona --> BE_GenPersona
    BE_GenPersona --> BE_CallLLM
    BE_CallLLM --> BE_SavePersona
    
    %% Session Start Flow
    BE_SavePersona --> BE_StartSession
    BE_StartSession --> UI_Navigate
```

## 🎙️ 3. Interview Phase

**User View:** The user interacts with the "Voice Orb", speaks or types messages, views real-time transcription deltas, and sees the interviewer's responses in a chat interface. They can end the interview to see feedback.
**Backend:** The `VoiceInterviewManager` handles streaming audio. It uses VAD (Voice Activity Detection) to detect speech, uses WebSockets or HTTP fallback to transcribe audio (ASR), sends text to the LLM, chunks the streaming response into sentences, and generates speech (TTS).

```mermaid
graph TD
    subgraph frontend ["User Interface (Interview)"]
        J["Speak into Microphone"]
        K["View Real-time Transcription"]
        L["Hear AI Voice & Read Chat"]
    end
    
    subgraph backend ["Backend (VoiceInterviewManager)"]
        J_backend["VAD detects speech boundaries"]
        K_backend["ASR Service (WebSocket / HTTP)"]
        L_backend["LLM Generates Streaming Text"]
        M_backend["Sentence Chunker"]
        N_backend["TTS Service Speaks Sentences"]
        
        J --> J_backend
        J_backend --> K_backend
        K_backend --> K
        K_backend --> L_backend
        L_backend --> M_backend
        M_backend --> N_backend
        N_backend --> L
    end
```