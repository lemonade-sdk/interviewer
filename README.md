# Interviewer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-powered interview practice application built on the principles of being **Simple, Lovable, and Complete**. Practice technical and behavioral interviews with ultra-realistic AI using your own hardware—100% local, zero cloud dependencies, and complete privacy.

---

## ✨ The SLC Philosophy

We built Interviewer to be **Simple, Lovable, and Complete** from day one.

### 🟢 Simple
- **Zero-Friction Setup**: Connects seamlessly to [Lemonade Server](https://github.com/lemonade-sdk/lemonade-server) for instant local AI inference.
- **Intuitive Workflow**: Just drop in a job description and your resume. The app handles the rest.
- **Clean UI**: A distraction-free, modern desktop interface that gets out of your way so you can focus on practicing.

### 💖 Lovable
- **Real-Time Voice**: Experience fluid, natural conversations with real-time Speech-to-Text (Whisper) and Text-to-Speech (Kokoro).
- **Dynamic Personas**: The AI doesn't just ask generic questions; it creates a tailored, named interviewer persona based on the specific company and role you're applying for.
- **Beautiful Design**: A polished React/Tailwind interface with smooth animations, dark mode, and thoughtful UX details.

### 🚀 Complete
- **End-to-End Lifecycle**: From document parsing to persona generation, through a dynamic multi-phase interview, all the way to comprehensive, graded post-interview feedback.
- **100% Local & Private**: Your voice, your resume, and your data never leave your machine. No API keys, no subscriptions, no data harvesting.
- **Cross-Platform**: A fully-featured Electron desktop app for Windows, macOS, and Linux.

---

## 🚀 Key Features

- **🎤 Voice-Enabled Interviews** - Realistic interview simulation with low-latency ASR and TTS.
- **🧠 Local AI Models** - Runs entirely on your hardware via Lemonade Server.
- **📋 Smart Document Extraction** - AI-powered parsing of resumes and job descriptions.
- **🎭 Dynamic Persona Generation** - Creates tailored interviewer personas based on the job/role.
- **📊 Comprehensive Feedback** - Detailed performance analysis with actionable insights and Q&A grading.
- **🔒 Privacy-First** - All data stored locally in JSON format.

## 🏗️ Architecture Overview

```text
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

## 🛠️ Tech Stack

### Frontend & Desktop
- **Framework**: React 18 + TypeScript
- **Desktop**: Electron
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand

### AI/ML (Local)
- **Inference Engine**: [Lemonade Server](https://github.com/lemonade-sdk/lemonade-server)
- **LLM**: Llama.cpp (GGUF models)
- **ASR**: Whisper (speech-to-text)
- **TTS**: Kokoro (text-to-speech)

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Lemonade Server** ([Installation Guide](https://github.com/lemonade-sdk/lemonade-server))
- **Git**

## 🔧 Installation & Quick Start

### 1. Install Lemonade Server
Follow the [Lemonade Server installation guide](https://github.com/lemonade-sdk/lemonade-server) to set up local LLM inference. Ensure it is running before starting the app.

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/lemonade-sdk/interviewer.git
cd interviewer

# Install Node.js dependencies
npm install
```

### 3. Run Development Mode
```bash
# Start the development server (React + Electron)
npm run dev
```

### 4. Build for Production
```bash
# Build React app & Electron app for distribution
npm run build:electron
```

## 🧠 Unified Prompt System (UCL)

The application uses a highly structured prompt architecture utilizing **Universal Control Language (UCL)** directives (e.g., `[[ENFORCE]]`, `[[REQUIRE]]`, `^^CONDITION^^`) to strictly guide the LLM's behavior across different stages:

1. **Dynamic Persona Generation**: Analyzes job descriptions and resumes to create tailored interviewer personas.
2. **Phase-Aware Interview Flow**: Seamlessly transitions between 5 distinct phases (Greeting → Q1 → Q2 → Q3 → Wrap-up), ensuring the AI maintains structure, tracks time, and avoids repetitive loops.
3. **Comprehensive Feedback**: Multi-stage post-interview analysis that extracts structured grades, strengths, weaknesses, and actionable insights.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit: `git commit -m 'feat: add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for better, private interview preparation.**
