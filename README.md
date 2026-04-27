# Interviewer

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D6?logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Linux-Ubuntu-E95420?logo=ubuntu&logoColor=white" alt="Linux/Ubuntu" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js 20+" />
  <a href="https://github.com/lemonade-sdk/interviewer/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/Privacy-Local--First-7c3aed" alt="Privacy: Local-First" />
  <a href="https://github.com/lemonade-sdk/lemonade">
    <img src="https://img.shields.io/badge/Powered%20by-Lemonade-FFD700" alt="Powered by Lemonade" /></a>
  <a href="https://arxiv.org/abs/2601.00880">
    <img src="https://img.shields.io/badge/arXiv-2601.00880-b31b1b.svg" alt="arXiv:2601.00880" /></a>
  <a href="https://doi.org/10.48550/arXiv.2601.00880">
    <img src="https://img.shields.io/badge/DOI-10.48550%2FarXiv.2601.00880-blue.svg" alt="DOI" /></a>
</p>

<p align="center">
  <img src="public/application-interviewer-image-5.png?raw=true" alt="Interviewer Banner" />
</p>

## Goal / Mission

**Interviewer** is a Proof of Concept AI-powered interview practice application designed to help a candidate prepare for real job interviews through voice enabled mock sessions. Built on the principle of **local-first privacy**, it runs entirely on your own hardware. No data ever leaves your machine, no API keys required, no subscription fees.

The application generates dynamic, context aware interviewer personas based on actual job descriptions and your resume, conducts multi phase technical and behavioral interviews with real time voice interaction, and provides comprehensive, actionable feedback to help you improve. 

- We are open to community contributions.
- Tested on the Strix Halo with 128GB RAM.
- Recommended Models: Qwen3-Coder-30B-A3B-Instruct-GGUF

##  Features

- **Voice-Enabled Interviews** - Realistic interview simulation with speech-to-text (ASR) and text-to-speech (TTS)
- **Local AI Models** - Runs entirely on your hardware via Lemonade Server—no cloud dependencies
- **Smart Document Extraction** - AI powered parsing of resumes and job descriptions
- **Dynamic Persona Generation** - Creates tailored interviewer personas based on job/role
- **Comprehensive Feedback** - Detailed performance analysis with actionable insights
- **Privacy-First** - All data stored locally in JSON format
- **Cross-Platform Desktop App** - Electron based for Windows, macOS, and Linux

##  Installation

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/lemonade-sdk/interviewer.git
cd interviewer

# Install Node.js dependencies
npm install
```

### 2. Install Lemonade Server

Follow the [Lemonade Server installation guide](https://github.com/lemonade-sdk/lemonade-server) to set up local LLM inference.

##  Quick Start

### Development Mode

```bash
# Windows / macOS
npm run dev

# Linux / Ubuntu
npm run dev:linux

# In a separate terminal, ensure Lemonade Server is running
lemonade-server
```

### Building for Production

```bash
# Build React app
npm run build

# Build Electron app for distribution
npm run build:electron
```

### Running Tests

```bash
# TypeScript tests
npm test
```

##  Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERVIEWER APP                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  Electron   │  │    React    │  │  TypeScript     │   │
│  │   (Main)    │  │    (UI)     │  │   Services      │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
│         │                │                   │            │
│         └────────────────┴───────────────────┘            │
│                          │                                │
│  ┌───────────────────────┼───────────────────────────┐     │
│  │         UNIFIED PROMPT SYSTEM                     │     │
│  │  ┌─────────────────┐  ┌─────────────────────┐   │     │
│  │  │ prompts.json    │  │ StructuredExtraction│   │     │
│  │  │ • 5 interview   │  │ • Document parsing  │   │     │
│  │  │   phases        │  │ • Job extraction    │   │     │
│  │  │ • Persona gen   │  │ • Feedback extract  │   │     │
│  │  │ • Feedback      │  │                     │   │     │
│  │  └─────────────────┘  └─────────────────────┘   │     │
│  └───────────────────────┼───────────────────────────┘     │
│                          │                                │
│  ┌───────────────────────┼───────────────────────────┐     │
│  │              PHASE-AWARE INTERVIEW FLOW          │     │
│  │  Greeting → Q1 → Q2 → Q3 → Wrap-up               │     │
│  │  Audio check → Self-Intro → Core Qs → Closing     │     │
│  └───────────────────────┼───────────────────────────┘     │
│                          │                                │
└──────────────────────────┼────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │    Lemonade Server      │
              │  (Local LLM Inference)  │
              │  • LLM (llama.cpp)      │
              │  • ASR (Whisper)        │
              │  • TTS (Kokoro)         │
              └─────────────────────────┘
```

##  Project Structure

```
interviewer/
├── src/
│   ├── services/              # Core business logic
│   │   ├── InterviewService.ts        # Interview orchestration
│   │   ├── LemonadeClient.ts          # LLM/AI API client
│   │   ├── PromptManager.ts           # Prompt template management
│   │   ├── PersonaGeneratorService.ts # Dynamic persona creation
│   │   ├── StructuredExtractionService.ts # Data extraction
│   │   └── audio/                     # TTS, ASR, VAD services
│   ├── data/
│   │   └── prompts.json               # Unified prompts (phases, persona, feedback)
│   ├── database/              # JSON-based storage layer
│   ├── types/                 # TypeScript definitions
│   ├── ui/                    # React components
│   └── electron_app/          # Electron main process
├── docs/                      # Documentation
└── tests/                     # Test suites
```

##  Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Desktop**: Electron
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand

### AI/ML (Local)
- **LLM**: Llama.cpp via Lemonade Server
- **ASR**: Whisper (speech-to-text)
- **TTS**: Kokoro (text-to-speech)
- **Inference**: Vulkan/ROCm/CUDA/CPU backends

### Backend Integration
- **HTTP**: OpenAI client + Axios for Lemonade Server

### Phase-Aware Interview Flow (5 Phases • 5 Core Questions)

The interview follows a strict **5-phase structure** with **exactly 5 dynamically generated core question topics** (Q1–Q5). All phases and questions are controlled by the unified prompt system in `prompts.json`.

| Phase | Focus | Description |
|---|---|---|
| **1. Greeting** | Audio check + Introduction | One-time audio check, persona self-introduction, session overview (duration + format) |
| **2. Q1 Active** | Warm-up / Baseline | Open rapport-building question + light follow-ups |
| **3. Q2 Active** | Core Technical | Job-specific technical depth probes |
| **4. Q3 Active** | Behavioral / Leadership | STAR-method behavioral questions + leadership signals |
| **5. Wrap-up** | Closing + Candidate Questions | Summary, feedback preview, open Q&A from candidate |

- **Total structured questions**: 5 main questions (Q1–Q5) with adaptive, context-aware follow-up probes.
- Question topics (`q1Topic` … `q5Topic`) and "watch signals" (resume gaps, red flags, etc.) are generated fresh every session from your JD + resume.

### Extraction & Feedback
- **Persona Generation**: Creates tailored 21+ field interviewer personas from job/resume
- **Document Extraction**: Parses resumes and job descriptions for context
- **Comprehensive Feedback**: Multi-stage analysis with structured Q&A grading

## Prompt Engineering & UCL Framework

The interview logic, persona generation, phase gating, and structured output are powered by `src/data/prompts.json`, which implements **Universal Conditional Logic (UCL)** — a formal mathematical framework for prompt optimization authored by the same developer.

This project is a production-grade real-world application of UCL for multi-turn, voice-interactive, agentic interview simulation.

##  Interview Flow

```
┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
│  Document   │   │   Persona   │   │    Interview    │
│  Upload     │ → │  Generation │ → │    Session      │
└─────────────┘   └─────────────┘   └─────────────────┘
       │                                    │
       ↓                                    ↓
┌─────────────┐                    ┌─────────────────┐
│  Extract    │                    │   5 Phases      │
│  Job/Resume │                    │   Dynamic Flow  │
└─────────────┘                    └─────────────────┘
                                          │
                                          ↓
                                   ┌─────────────────┐
                                   │   Feedback      │
                                   │   Generation    │
                                   └─────────────────┘
```

## Linux / Ubuntu Notes

The app runs on Ubuntu out of the box. A few things to be aware of:

- Use `npm run dev:linux` instead of `npm run dev` — this passes the required `--no-sandbox` flag to Electron, bypassing the SUID sandbox requirement that causes a crash on most Linux setups.
- The default model (`Qwen3-Coder-30B-A3B-Instruct-GGUF`) is set automatically. If you previously ran an older version that saved a different model name (e.g. `gpt-oss-mxp4`), the app will auto-correct it on next startup.
- For packaged AppImage builds, no extra flags are needed — the sandbox is handled at the app level.

##  Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  Acknowledgments

- [Lemonade Server](https://github.com/lemonade-sdk/lemonade-server) - Unified local AI inference
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Efficient LLM inference
- [Whisper](https://github.com/openai/whisper) - OpenAI's ASR model
- [Kokoro](https://github.com/kokoro-js/kokoro) - Fast TTS

## References

- Anthony Mikinka. "Universal Conditional Logic: A Formal Language for Prompt Engineering." *arXiv:2601.00880* (2025). https://arxiv.org/abs/2601.00880 · [GitHub](https://github.com/antmikinka/Universal-Conditional-Logic)
---

**Made with ❤️ for better, private interview preparation**
