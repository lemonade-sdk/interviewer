# AI Interviewer

An intelligent interview practice application powered by **local AI** via Lemonade Server. Built with Electron and React, this application runs AI models locally on your NPU/GPU - ensuring complete privacy, zero API costs, and offline capability. Practice your interview skills with an AI interviewer that adapts to your needs and provides comprehensive feedback.

## 🚀 Features

- **AI-Powered Interviews**: Conduct realistic interview sessions with AI that adapts to different interview types (technical, behavioral, system design, coding, etc.)
- **Multiple Interview Types**: Practice for various interview scenarios
  - Technical interviews
  - Behavioral interviews
  - System design interviews
  - Coding interviews
  - General interviews
  - Mixed format interviews

- **Job Application Tracking**: Keep track of your job applications and link them to interview practice sessions
- **Comprehensive Feedback**: Get detailed feedback on your performance with:
  - Overall score
  - Strengths analysis
  - Areas for improvement
  - Specific suggestions
  - Detailed transcript review

- **Interview History**: Review past interviews, transcripts, and feedback
- **Customizable Settings**: Configure the AI interviewer to match your preferences
  - Interview style (conversational, formal, challenging, supportive)
  - Question difficulty (easy, medium, hard)
  - Number of questions
  - Model selection and parameters

- **MCP Integration**: Extensible architecture supporting Model Context Protocol for additional capabilities
- **Cross-Platform**: Desktop application for Windows, macOS, and Linux

## 📋 Prerequisites

- **Node.js 18+** and npm
- **Lemonade Server** - [Download and install](https://lemonade-server.ai/docs/)
- Git (for cloning the repository)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd interviewer
```

2. Install dependencies:
```bash
npm install
```

3. Install and start Lemonade Server:
```bash
# Download from https://lemonade-server.ai/docs/
# After installation, pull a model:
lemonade-server pull Llama-3.2-1B-Instruct-Hybrid

# Start the server
lemonade-server start

# Verify it's running at http://localhost:8000
```

**Note**: No API keys needed! Everything runs locally on your machine.

## 🏃 Running the Application

### Development Mode

```bash
# Start the development server
npm run dev
```

This will start both the React development server and Electron in development mode with hot reloading.

### Production Build

```bash
# Build the React app
npm run build

# Build the Electron application
npm run build:electron
```

The built application will be in the `dist` directory.

## 📁 Project Structure

```
interviewer/
├── src/
│   ├── electron_app/          # Electron main process
│   │   ├── main.js            # Main Electron entry point
│   │   └── preload.js         # Preload script for IPC
│   │
│   ├── ui/                    # React frontend
│   │   ├── components/        # Reusable UI components
│   │   │   └── Layout.tsx     # Main layout component
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Interview.tsx
│   │   │   ├── InterviewHistory.tsx
│   │   │   ├── Jobs.tsx
│   │   │   └── Settings.tsx
│   │   ├── store/             # State management
│   │   │   └── useStore.ts
│   │   ├── App.tsx            # Main App component
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Global styles
│   │
│   ├── database/              # Database layer
│   │   ├── db.ts              # Database initialization
│   │   ├── schema.sql         # Database schema
│   │   └── repositories/      # Data access layer
│   │       ├── InterviewRepository.ts
│   │       ├── JobRepository.ts
│   │       └── SettingsRepository.ts
│   │
│   ├── services/              # Business logic
│   │   ├── InterviewService.ts    # Interview management
│   │   └── LemonadeClient.ts      # Lemonade SDK integration
│   │
│   ├── mcp/                   # Model Context Protocol
│   │   └── MCPManager.ts      # MCP server management
│   │
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   │
│   └── utils/                 # Utility functions
│       └── helpers.ts
│
├── public/                    # Static assets
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
└── README.md                 # This file
```

## 🎯 Usage Guide

### Starting a New Interview

1. Click "New Interview" on the Dashboard
2. Fill in the interview details:
   - Interview title
   - Company name
   - Position
   - Interview type
3. Click "Start Interview"
4. Engage in conversation with the AI interviewer
5. Click "End Interview" when finished to receive feedback

### Managing Job Applications

1. Navigate to "Job Applications" from the sidebar
2. Click "Add Job" to create a new application entry
3. Fill in job details and track the status
4. Link interviews to specific job applications

### Customizing Interview Settings

1. Go to Settings → Interviewer AI
2. Configure:
   - Model provider and model
   - Interview style
   - Question difficulty
   - Number of questions
   - Temperature and token limits
   - Follow-up questions and feedback preferences

### Reviewing Past Interviews

1. Navigate to "Interview History"
2. Use search and filters to find specific interviews
3. Click "View Details" to see:
   - Complete transcript
   - Feedback and scores
   - Strengths and weaknesses
   - Improvement suggestions

## 🔧 Configuration

### Database

The application uses SQLite for local data storage. The database file is automatically created in the user data directory:

- **Windows**: `%APPDATA%/ai-interviewer/interviewer.db`
- **macOS**: `~/Library/Application Support/ai-interviewer/interviewer.db`
- **Linux**: `~/.config/ai-interviewer/interviewer.db`

### Lemonade Server Integration

The application integrates with **Lemonade Server** - a local LLM server that:
- Runs on your machine at `http://localhost:8000`
- Uses your NPU and GPU for AI acceleration
- Implements the OpenAI API standard
- Provides 100% privacy - no data leaves your machine
- Works completely offline (after models are downloaded)

For detailed integration information, see [LEMONADE_SERVER_INTEGRATION.md](LEMONADE_SERVER_INTEGRATION.md)

### MCP Server Support

Model Context Protocol servers can extend the application's capabilities. Configure servers in Settings → MCP Servers (coming soon).

## 🧪 Testing

```bash
npm test
```

## 🐛 Troubleshooting

### Database Issues

If you experience database errors:
1. Close the application
2. Delete the database file from the user data directory
3. Restart the application (a new database will be created)

### Interview Not Starting

Ensure that:
1. Lemonade Server is running at http://localhost:8000
2. A model is loaded in Lemonade Server
3. All required fields are filled in the interview form
4. Check Settings → Interviewer AI for server connection status
5. Check the developer console for error messages (View → Toggle Developer Tools)

### Performance Issues

If the application feels slow:
1. Reduce the max tokens setting in Interviewer AI settings
2. Close other resource-intensive applications
3. Check your internet connection if using cloud-based AI models

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- State management with [Zustand](https://github.com/pmndrs/zustand)
- Local AI powered by [Lemonade Server](https://lemonade-server.ai/)
- Database with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- OpenAI API client for Lemonade Server integration

## 📧 Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

**Happy interviewing! 🎉**
