# AI Interviewer - Architecture Documentation

## Overview

AI Interviewer is a desktop application built using Electron, React, and TypeScript. It provides an intelligent interview practice platform powered by AI models through the Lemonade SDK integration.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │    IPC     │  │   Database  │  │   MCP Manager      │   │
│  │  Handlers  │──│   (SQLite)  │  │   (Child Proc.)    │   │
│  └────────────┘  └─────────────┘  └────────────────────┘   │
│         │                │                    │              │
│         │                │                    │              │
│  ┌──────▼────────────────▼────────────────────▼──────────┐  │
│  │              Services Layer                            │  │
│  │  - InterviewService                                    │  │
│  │  - LemonadeClient (AI Integration)                     │  │
│  │  - MCPManager                                          │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC Bridge
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    Electron Renderer Process                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    React Application                    │ │
│  │                                                         │ │
│  │  ┌──────────────┐  ┌─────────────────────────────┐   │ │
│  │  │  UI Layer    │  │   State Management (Zustand) │   │ │
│  │  │              │  │                              │   │ │
│  │  │  - Dashboard │  │  - interviews[]              │   │ │
│  │  │  - Interview │  │  - jobs[]                    │   │ │
│  │  │  - History   │  │  - settings                  │   │ │
│  │  │  - Jobs      │  │  - currentInterview          │   │ │
│  │  │  - Settings  │  │                              │   │ │
│  │  └──────────────┘  └─────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Electron Main Process

**Location**: `src/electron_app/main.js`

Responsibilities:
- Application lifecycle management
- Window management
- IPC communication handling
- Service initialization
- Database connection management
- MCP server orchestration

Key Features:
- Registers IPC handlers for all operations
- Initializes database on app start
- Manages interview service lifecycle
- Handles graceful shutdown

### 2. Preload Script

**Location**: `src/electron_app/preload.js`

Responsibilities:
- Exposes safe IPC methods to renderer process
- Creates `window.electronAPI` interface
- Maintains security through context isolation

### 3. Database Layer

**Location**: `src/database/`

**Schema**: SQLite database with the following tables:
- `interviews`: Interview records and transcripts
- `jobs`: Job application tracking
- `user_settings`: User preferences
- `interviewer_settings`: AI configuration
- `model_configs`: Available AI models
- `mcp_servers`: MCP server configurations

**Repositories**:
- `InterviewRepository`: CRUD operations for interviews
- `JobRepository`: Job application management
- `SettingsRepository`: Settings persistence

Design Pattern: Repository pattern for data access abstraction

### 4. Services Layer

#### InterviewService

**Location**: `src/services/InterviewService.ts`

Responsibilities:
- Manages interview lifecycle
- Coordinates with LemonadeClient for AI interactions
- Generates interview feedback
- Maintains conversation context

Key Methods:
- `startInterview()`: Initializes interview session
- `sendMessage()`: Processes user responses
- `endInterview()`: Generates comprehensive feedback
- `getAvailableModels()`: Lists AI models

#### LemonadeClient

**Location**: `src/services/LemonadeClient.ts`

Responsibilities:
- Wraps Lemonade SDK for AI model interactions
- Manages conversation history
- Handles model selection and configuration
- Provides mock responses for MVP testing

Key Features:
- Model-agnostic interface
- Support for multiple AI providers (OpenAI, Anthropic, etc.)
- Configurable parameters (temperature, max_tokens, etc.)
- Error handling and retry logic

### 5. MCP Manager

**Location**: `src/mcp/MCPManager.ts`

Responsibilities:
- Manages Model Context Protocol servers
- Spawns and monitors child processes
- Provides event-based communication
- Handles server lifecycle (start, stop, restart)

Design Pattern: Observer pattern for event handling

### 6. React Application

**Location**: `src/ui/`

#### State Management (Zustand)

**Location**: `src/ui/store/useStore.ts`

Global state includes:
- `interviews[]`: All interview records
- `jobs[]`: Job applications
- `currentInterview`: Active interview session
- `settings`: User preferences
- `interviewerSettings`: AI configuration
- `isLoading`: Loading state
- `error`: Error messages

#### Pages

**Dashboard** (`src/ui/pages/Dashboard.tsx`):
- Overview statistics
- Recent interviews
- Quick actions (start new interview)

**Interview** (`src/ui/pages/Interview.tsx`):
- Real-time conversation interface
- Message history
- Send/receive functionality
- End interview action

**Interview History** (`src/ui/pages/InterviewHistory.tsx`):
- List all past interviews
- Search and filter functionality
- Detailed view with transcript and feedback
- Delete operations

**Jobs** (`src/ui/pages/Jobs.tsx`):
- Job application tracking
- Status management (interested, applied, interviewing, offer, etc.)
- Link interviews to jobs
- CRUD operations

**Settings** (`src/ui/pages/Settings.tsx`):
- General settings (theme, language, notifications)
- Interviewer AI settings (model, style, difficulty)
- MCP server configuration

## Data Flow

### Interview Session Flow

```
1. User initiates interview
   └─> UI: Dashboard → "New Interview" modal
   └─> User fills form (title, company, position, type)

2. Start interview request
   └─> IPC: interview:start
   └─> Main Process: InterviewRepository.create()
   └─> Main Process: InterviewService.startInterview()
   └─> LemonadeClient: Generate initial greeting
   └─> Response sent to UI

3. Conversation loop
   └─> User types message
   └─> IPC: interview:sendMessage
   └─> InterviewService.sendMessage()
   └─> LemonadeClient: Process with conversation history
   └─> AI response generated
   └─> Transcript updated in database
   └─> Response sent to UI

4. End interview
   └─> IPC: interview:end
   └─> InterviewService.endInterview()
   └─> LemonadeClient: Generate feedback
   └─> InterviewRepository.update() with feedback
   └─> Navigate to dashboard with feedback displayed
```

### Settings Update Flow

```
1. User modifies settings
   └─> Settings form updated in UI

2. Save changes
   └─> IPC: settings:update or settings:updateInterviewer
   └─> SettingsRepository.update()
   └─> Database persisted
   └─> If interviewer settings: InterviewService reinitialized
   └─> Confirmation sent to UI
```

## Security Considerations

1. **Context Isolation**: Renderer process isolated from Node.js
2. **IPC Validation**: All IPC handlers validate inputs
3. **SQL Injection Prevention**: Prepared statements used throughout
4. **API Key Protection**: Stored securely, never exposed to renderer
5. **MCP Sandboxing**: Child processes run with limited permissions

## Performance Optimizations

1. **Database Indexing**: Key fields indexed for fast queries
2. **Lazy Loading**: Interview transcripts loaded on demand
3. **State Management**: Minimal re-renders with Zustand
4. **Virtual Scrolling**: For large lists (interview history)
5. **Debounced Search**: Search inputs debounced to reduce queries

## Extensibility

### Adding New Interview Types

1. Update `InterviewType` in `src/types/index.ts`
2. Add type to UI selectors
3. Update system prompt in `InterviewService.buildSystemPrompt()`

### Adding New AI Models

1. Update `LemonadeClient.initializeModels()`
2. Add model to Settings UI
3. Configure provider-specific parameters

### Adding MCP Servers

1. Define server configuration
2. Add to Settings → MCP Servers
3. MCPManager automatically handles lifecycle

## Testing Strategy

- **Unit Tests**: Services and utilities
- **Integration Tests**: Database operations
- **E2E Tests**: User flows (interview creation, job tracking)
- **Manual Testing**: UI/UX validation

## Deployment

### Build Process

```bash
1. npm run build          # Build React app
2. npm run build:electron # Package Electron app
3. Distribute installers from dist/
```

### Supported Platforms

- Windows (NSIS installer)
- macOS (DMG)
- Linux (AppImage)

## Future Enhancements

1. **Voice Input**: Speech-to-text for natural conversations
2. **Video Practice**: Record and analyze video responses
3. **Team Features**: Share feedback with mentors
4. **Analytics Dashboard**: Track improvement over time
5. **Custom Prompts**: User-defined interview scenarios
6. **Cloud Sync**: Backup interviews to cloud storage
7. **Mobile Companion**: View history on mobile devices

## Technology Stack

- **Framework**: Electron 28+
- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Database**: SQLite (better-sqlite3)
- **Build**: Vite, electron-builder
- **AI**: Lemonade SDK (with fallback mocks)
- **IPC**: Electron IPC (contextBridge)

## Code Organization Principles

1. **Separation of Concerns**: UI, business logic, data access separated
2. **Single Responsibility**: Each module has one clear purpose
3. **Dependency Injection**: Services accept configuration
4. **Repository Pattern**: Abstract database operations
5. **Type Safety**: Comprehensive TypeScript types
6. **Error Handling**: Graceful degradation with user feedback

## Maintenance

### Database Migrations

Currently using schema.sql for initialization. For future migrations:
1. Create migration scripts in `src/database/migrations/`
2. Version tracking in `schema_version` table
3. Auto-apply on app start

### Logging

- Console logs for development
- Production: Consider electron-log for file logging
- Error tracking: Consider Sentry integration

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)
