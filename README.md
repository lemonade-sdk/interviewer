# Interviewer

[![Main CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/main-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/main-ci.yml)
[![Python CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/python-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/python-ci.yml)
[![Node.js CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/nodejs-ci.yml)
[![CodeQL](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/codeql-security.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/codeql-security.yml)
[![Documentation](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/docs-deploy.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/docs-deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note:** Replace `YOUR-USERNAME` in the badge URLs above with your actual GitHub username or organization name.

An AI-powered interview practice application with **local-first privacy**. Practice technical and behavioral interviews with AI using your own hardware - no data leaves your machine.

## 🚀 Features

- **🎤 Voice-Enabled Interviews** - Realistic interview simulation with speech-to-text (ASR) and text-to-speech (TTS)
- **🧠 Local AI Models** - Runs entirely on your hardware via Lemonade Server - no cloud dependencies
- **📋 Smart Document Extraction** - AI-powered parsing of resumes and job descriptions
- **🎭 Dynamic Persona Generation** - Creates tailored interviewer personas based on job/role
- **📊 Comprehensive Feedback** - Detailed performance analysis with actionable insights
- **🔒 Privacy-First** - All data stored locally in JSON format
- **🖥️ Cross-Platform Desktop App** - Electron-based for Windows, macOS, and Linux

## 🏗️ Architecture Overview

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
│  │  │ phase-prompts   │  │ extraction-prompts  │   │     │
│  │  │ • 10 interview  │  │ • Document parsing  │   │     │
│  │  │   phases        │  │ • Job extraction    │   │     │
│  │  │ • Persona gen   │  │ • Feedback extract  │   │     │
│  │  │ • Feedback      │  │                     │   │     │
│  │  └─────────────────┘  └─────────────────────┘   │     │
│  └───────────────────────┼───────────────────────────┘     │
│                          │                                │
│  ┌───────────────────────┼───────────────────────────┐     │
│  │              PHASE-AWARE INTERVIEW FLOW          │     │
│  │  phase_0 → phase_1 → ... → phase_9 (10 phases)   │     │
│  │  Audio → Warm-up → Q1-Q5 → Closing             │     │
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

## 📦 Project Structure

```
interviewer/
├── src/
│   ├── services/              # Core business logic
│   │   ├── PhasePromptBuilder.ts      # Interview/persona/feedback prompts
│   │   ├── ExtractionPromptBuilder.ts # Data extraction prompts
│   │   ├── InterviewService.ts        # Interview orchestration
│   │   ├── VoiceInterviewManager.ts   # Voice handling
│   │   └── InterviewPhaseManager.ts   # Phase transitions
│   ├── data/
│   │   ├── phase-prompts.json         # Interview phases & prompts
│   │   └── extraction-prompts.json    # Extraction prompts
│   ├── types/                 # TypeScript definitions
│   ├── ui/                    # React components
│   └── electron_app/          # Electron main process
├── lemonade_api/              # Python API client
│   ├── client.py              # Lemonade Server client
│   ├── models.py              # Pydantic models
│   └── exceptions.py          # Error handling
├── docs/                      # Documentation
└── tests/                     # Test suites
```

## 🛠️ Tech Stack

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
- **API Client**: Python 3.9+ with Pydantic
- **HTTP**: httpx with WebSocket support
- **Documentation**: MkDocs Material

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Lemonade Server** ([Installation Guide](https://github.com/lemonade-sdk/lemonade-server))
- **Git**

## 🔧 Installation

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/YOUR-USERNAME/interviewer.git
cd interviewer

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r lemonade_api/requirements-dev.txt
```

### 2. Install Lemonade Server

Follow the [Lemonade Server installation guide](https://github.com/lemonade-sdk/lemonade-server) to set up local LLM inference.

## 🚀 Quick Start

### Development Mode

```bash
# Start the development server (React + Electron)
npm run dev

# In a separate terminal, ensure Lemonade Server is running
lemonade-server
```

### Running Tests

```bash
# Python tests
pytest --cov=lemonade_api --cov-report=html

# TypeScript tests
npm test
```

### Building for Production

```bash
# Build React app
npm run build

# Build Electron app for distribution
npm run build:electron
```

## 🧠 Unified Prompt System

The application uses a unified prompt architecture with two JSON configuration files:

### Phase Prompts (`src/data/phase-prompts.json`)
Contains three categories of prompts:
1. **Interview Phases** (10 sequential phases)
   - phase_0_audio_check → phase_1_warm_rapport → ... → phase_9_closing
   - Each phase has system prompts, response patterns, and transition rules

2. **Persona Generation**
   - Analyzes job descriptions and resumes
   - Creates tailored interviewer personas with 21+ structured fields

3. **Feedback Generation**
   - Comprehensive post-interview analysis
   - Question-level grading with actionable insights

### Extraction Prompts (`src/data/extraction-prompts.json`)
Handles data extraction tasks:
- Document parsing (resumes, job posts)
- Job details extraction
- Feedback parsing and grading

## 🎭 Interview Flow

```
┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
│  Document   │   │   Persona   │   │    Interview    │
│  Upload     │ → │  Generation │ → │    Session      │
└─────────────┘   └─────────────┘   └─────────────────┘
       │                                    │
       ↓                                    ↓
┌─────────────┐                    ┌─────────────────┐
│  Extract    │                    │   10 Phases     │
│  Job/Resume │                    │   Dynamic Flow  │
└─────────────┘                    └─────────────────┘
                                          │
                                          ↓
                                   ┌─────────────────┐
                                   │   Feedback      │
                                   │   Generation    │
                                   └─────────────────┘
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture Guide](docs/ARCHITECTURE.md) | System architecture and flow diagrams |
| [API Documentation](lemonade_api/docs/index.md) | Python client API reference |
| [Variables Reference](docs/VARIABLES_REFERENCE.md) | Template variable documentation |
| [Agent Persona Guide](docs/AGENT_PERSONA_GUIDE.md) | Interviewer persona system |
| [Contributing Guide](docs/community/CONTRIBUTING.md) | How to contribute |

## 🔄 CI/CD Pipeline

- ✅ **Python CI**: Black, Ruff, MyPy, pytest
- ✅ **Node.js CI**: ESLint, TypeScript, Jest
- ✅ **CodeQL Security**: Automated vulnerability scanning
- 📦 **Documentation**: Auto-deploy to GitHub Pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

See [Contributing Guide](docs/community/CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Lemonade Server](https://github.com/lemonade-sdk/lemonade-server) - Unified local AI inference
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Efficient LLM inference
- [Whisper](https://github.com/openai/whisper) - OpenAI's ASR model
- [Kokoro](https://github.com/kokoro-js/kokoro) - Fast TTS

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR-USERNAME/interviewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR-USERNAME/interviewer/discussions)

---

**Made with ❤️ for better interview preparation**
