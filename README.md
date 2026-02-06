# Interviewer

[![Main CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/main-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/main-ci.yml)
[![Python CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/python-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/python-ci.yml)
[![Node.js CI](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/nodejs-ci.yml)
[![CodeQL](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/codeql-security.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/codeql-security.yml)
[![Documentation](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/docs-deploy.yml/badge.svg)](https://github.com/YOUR-USERNAME/interviewer/actions/workflows/docs-deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note:** Replace `YOUR-USERNAME` in the badge URLs above with your actual GitHub username or organization name.

An AI-powered interview practice application with Lemonade Server integration. Practice technical interviews with AI assistance using local language models.

## 🚀 Features

- **Desktop Application**: Cross-platform Electron app for Windows, macOS, and Linux
- **AI-Powered Interviews**: Practice with AI using local language models
- **Python API Client**: Full-featured Python client for Lemonade Server
- **Voice Features**: Audio processing for realistic interview simulation
- **TypeScript/React UI**: Modern, responsive user interface
- **Local Storage**: JSON-based storage architecture for privacy
- **Comprehensive Documentation**: Built with MkDocs Material

## 📦 Project Structure

```
interviewer/
├── src/                      # TypeScript/React application
│   ├── ui/                   # React UI components
│   ├── electron_app/         # Electron main process
│   ├── database/             # Database layer
│   ├── services/             # Service layer
│   └── types/                # TypeScript type definitions
├── lemonade_api/             # Python API client
│   ├── client.py             # Main client implementation
│   ├── models.py             # Pydantic models
│   ├── exceptions.py         # Custom exceptions
│   └── docs/                 # API documentation
├── tests/                    # Test suites
│   ├── lemonade_api/         # Python tests
│   └── __tests__/            # TypeScript/Jest tests
├── docs/                     # Project documentation
└── .github/                  # CI/CD workflows

```

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Desktop**: Electron

### Backend/API
- **Language**: Python 3.9+
- **Framework**: Pydantic for data validation
- **HTTP Client**: httpx
- **Documentation**: MkDocs Material

### Testing
- **Python**: pytest, pytest-cov
- **TypeScript**: Jest
- **Linting**: ESLint, Ruff, Black
- **Type Checking**: TypeScript, MyPy

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Git**

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/ai-interviewer.git
cd ai-interviewer
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Install Python dependencies

```bash
pip install -r lemonade_api/requirements-dev.txt
```

## 🚀 Quick Start

### Development Mode

**Run React + Electron:**
```bash
npm run dev
```

**Run Python API tests:**
```bash
pytest
```

**View Documentation:**
```bash
cd lemonade_api
mkdocs serve
```

### Building

**Build React app:**
```bash
npm run build
```

**Build Electron app:**
```bash
npm run build:electron
```

**Build Python package:**
```bash
python -m build
```

## 🧪 Testing

### Run all tests

**Python:**
```bash
pytest --cov=lemonade_api --cov-report=html
```

**TypeScript:**
```bash
npm test
```

### Linting

**Python:**
```bash
black lemonade_api/
ruff check lemonade_api/
mypy lemonade_api/
```

**TypeScript:**
```bash
npm run lint
```

## 📚 Documentation

- **[API Documentation](lemonade_api/docs/index.md)** - Python client API reference
- **[CI/CD Documentation](.github/CI_CD_DOCUMENTATION.md)** - Comprehensive CI/CD guide
- **[Workflows README](.github/workflows/README.md)** - GitHub Actions workflows
- **[Contributing Guide](docs/guides/CONTRIBUTING.md)** - How to contribute
- **[Deployment Guide](docs/guides/DEPLOYMENT_GUIDE.md)** - Deployment instructions

## 🔄 CI/CD Pipeline

This project uses a comprehensive GitHub Actions CI/CD pipeline:

### Continuous Integration
- ✅ **Python CI**: Linting (Black, Ruff), type checking (MyPy), testing (pytest)
- ✅ **Node.js CI**: Linting (ESLint), TypeScript checks, testing (Jest), building
- ✅ **CodeQL Security**: Automated vulnerability scanning
- ✅ **Dependency Review**: Security checks for dependency changes

### Continuous Deployment
- 📦 **Documentation**: Auto-deploy to GitHub Pages on main branch
- 🚀 **Electron Release**: Multi-platform builds on version tags
- 🔄 **Dependabot**: Automated weekly dependency updates

**[See full CI/CD documentation](.github/CI_CD_DOCUMENTATION.md)** for detailed information.

## 🔐 Security

- **CodeQL Analysis**: Automated security scanning on every PR
- **Dependency Review**: Scans for vulnerable dependencies
- **Dependabot**: Automated security updates
- **Branch Protection**: Required status checks on main branch

## 🏗️ Architecture

### Modular Design
- **Separation of Concerns**: Clear separation between UI, business logic, and data layers
- **Type Safety**: Full TypeScript and Pydantic type definitions
- **Testability**: Comprehensive test coverage with unit and integration tests
- **Scalability**: Modular architecture supports easy feature additions

### Storage
- **JSON-based**: Privacy-focused local storage
- **Repositories**: Clean data access patterns
- **TypeScript Types**: Full type safety across the stack

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/guides/CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

All PRs are automatically checked by our CI pipeline.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Lemonade Server](https://github.com/lemonade-server/lemonade) - Unified API for local AI models
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://react.dev/) - UI framework
- [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) - Documentation theme

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR-USERNAME/interviewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR-USERNAME/interviewer/discussions)
- **Documentation**: [Project Docs](https://YOUR-USERNAME.github.io/interviewer/)

## 🗺️ Roadmap

- [ ] Enhanced voice features
- [ ] More interview templates
- [ ] Performance analytics
- [ ] Cloud sync (optional)
- [ ] Mobile app support

---

**Made with ❤️ by the AI Interviewer Team**
