# Interviewer

[![Main CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/main-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/main-ci.yml)
[![Python CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/python-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/python-ci.yml)
[![Node.js CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/nodejs-ci.yml)
[![CodeQL](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/codeql-security.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/codeql-security.yml)
[![Documentation](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/docs-deploy.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/docs-deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note:** Replace `YOUR-USERNAME` in the badge URLs above with your actual GitHub username or organization name.

An AI-powered interview practice application with **local-first privacy**. Practice technical and behavioral interviews with AI using your own hardware—no data leaves your machine.

## 🚀 Features

- **🎤 Voice-Enabled Interviews** - Realistic interview simulation with speech-to-text (ASR) and text-to-speech (TTS)
- **🧠 Local AI Models** - Runs entirely on your hardware via Lemonade Server—no cloud dependencies
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

## 📦 Project Structure

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
- **HTTP**: OpenAI client + Axios for Lemonade Server
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

## 🧠 Unified Prompt System (UCL)

The application uses a highly structured prompt architecture utilizing **Universal Control Language (UCL)** directives (e.g., `[[ENFORCE]]`, `[[REQUIRE]]`, `^^CONDITION^^`) to strictly guide the LLM's behavior:

### Phase-Aware Interview Flow (`src/data/prompts.json`)

1. **Greeting Phase** - Audio check, self-introduction, session overview
2. **Q1 Active** - Warm-up baseline question
3. **Q2 Active** - Core technical probe
4. **Q3 Active** - Behavioral/leadership probe
5. **Wrap-up** - Closing remarks and candidate questions

### Extraction & Feedback
- **Persona Generation**: Creates tailored 21+ field interviewer personas from job/resume
- **Document Extraction**: Parses resumes and job descriptions for context
- **Comprehensive Feedback**: Multi-stage analysis with structured Q&A grading

## 🎭 Interview Flow

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
