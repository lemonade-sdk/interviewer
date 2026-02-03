# Quick Start Guide

Get up and running with AI Interviewer in 5 minutes!

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- **Lemonade Server** installed and running ([Download here](https://lemonade-server.ai/docs/))

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages including Electron, React, and other dependencies.

### 2. Start Lemonade Server

```bash
# Download a model (first time only)
lemonade-server pull Llama-3.2-1B-Instruct-Hybrid

# Start the server
lemonade-server start
```

Verify it's running by visiting http://localhost:8000/api/v1/health

### 3. Start Development Server

```bash
npm run dev
```

This command starts both:
- React development server on `http://localhost:5173`
- Electron application window

The application will automatically connect to your local Lemonade Server.

## First Run

When you first launch the application:

1. **Welcome Screen**: You'll see the Dashboard with no interviews yet
2. **Server Check**: Application checks if Lemonade Server is running
3. **Database Creation**: SQLite database is automatically created in your user data folder
4. **Default Settings**: Application starts with sensible defaults

**Important**: Check Settings → Interviewer AI to verify Lemonade Server connection status (should show green "Connected").

## Creating Your First Interview

### Step 1: Start New Interview

1. Click the **"New Interview"** button on the Dashboard
2. Fill in the form:
   - **Interview Title**: e.g., "Senior Software Engineer Practice"
   - **Company**: e.g., "Tech Corp"
   - **Position**: e.g., "Senior Software Engineer"
   - **Interview Type**: Choose from Technical, Behavioral, System Design, etc.
3. Click **"Start Interview"**

### Step 2: Conduct the Interview

1. Read the AI interviewer's greeting
2. Type your response in the message box
3. Press **Enter** or click **"Send"**
4. Continue the conversation naturally
5. The AI will ask follow-up questions based on your responses

### Step 3: End the Interview

1. Click **"End Interview"** when you're ready to finish
2. Confirm the action
3. View your comprehensive feedback including:
   - Overall score
   - Strengths
   - Areas for improvement
   - Specific suggestions

## Exploring Features

### Dashboard

- View statistics: Total interviews, average score, active applications
- Quick access to recent interviews
- Start new interviews

### Interview History

- Browse all past interviews
- Search by company, position, or title
- View detailed transcripts and feedback
- Delete old interviews

### Job Applications

- Track job applications
- Update application status (interested, applied, interviewing, offer)
- Link interviews to specific jobs
- Add notes and details

### Settings

#### General Settings
- Theme: Light, Dark, or System
- Language preferences
- Notification settings
- Auto-save options

#### Interviewer AI Settings
- **Model Selection**: Choose AI model (GPT-4, Claude, etc.)
- **Interview Style**: Conversational, Formal, Challenging, or Supportive
- **Question Difficulty**: Easy, Medium, or Hard
- **Number of Questions**: Customize interview length
- **Temperature**: Control AI creativity (0.0 - 1.0)
- **Follow-up Questions**: Enable/disable
- **Feedback**: Enable/disable end-of-interview feedback

## Tips for Best Experience

### 1. Be Authentic

Answer questions as you would in a real interview. The AI learns from genuine responses.

### 2. Take Your Time

Don't rush. Think through your answers just like you would in an actual interview.

### 3. Review Feedback

After each interview, carefully review the feedback to identify improvement areas.

### 4. Practice Different Types

Try various interview types to be well-rounded:
- Technical for coding skills
- Behavioral for soft skills
- System Design for architecture
- Mixed for comprehensive practice

### 5. Track Progress

Use the Job Applications feature to:
- Link practice sessions to real applications
- Track which companies you've practiced for
- Monitor your improvement over time

## Common Tasks

### Adjusting Interview Difficulty

If interviews are too easy or hard:
1. Go to **Settings → Interviewer AI**
2. Change **Question Difficulty**
3. Adjust **Interview Style** for more/less challenging tone
4. Save changes

### Changing AI Model

To use a different local AI model:
1. Download the model using Lemonade Server:
   ```bash
   lemonade-server pull <model-name>
   ```
2. Go to **Settings → Interviewer AI**
3. Click **"Refresh Models"** to fetch available models from your server
4. Select your preferred model from the dropdown
5. Save changes

Popular models:
- **Llama-3.2-1B-Instruct-Hybrid** - Fast, good for older hardware
- **Llama-3.2-3B-Instruct-Hybrid** - Better quality, needs more resources
- **Phi-3.5-mini-instruct-Hybrid** - High quality, balanced performance

### Exporting Interview Data

Currently, interview data is stored locally in SQLite. To backup:
- Find database at: `%APPDATA%/ai-interviewer/interviewer.db` (Windows)
- Copy this file to backup location

## Troubleshooting

### Application Won't Start

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database Errors

If you get database errors:
1. Close the application
2. Delete the database file from user data directory
3. Restart the application (new database created automatically)

### Interview Not Responding

Check:
1. Internet connection (if using cloud AI models)
2. Console for errors (View → Toggle Developer Tools)
3. AI model settings in Settings → Interviewer AI

### Performance Issues

If the app feels slow:
1. Reduce **Max Tokens** in settings
2. Use lighter AI model (GPT-3.5 instead of GPT-4)
3. Close other resource-intensive apps

## Development Mode Features

### Developer Tools

Access Chrome DevTools:
- **Windows/Linux**: Ctrl + Shift + I
- **macOS**: Cmd + Option + I

### Hot Reload

Changes to React components automatically reload the UI without restarting Electron.

### Mock AI Responses

The MVP includes mock AI responses for testing without API keys. To use real AI:
1. Add API keys to `.env` file (see `.env.example`)
2. Update `LemonadeClient.ts` with actual SDK integration

## Next Steps

1. **Practice regularly**: Set a schedule for interview practice
2. **Review feedback**: Focus on consistent weaknesses
3. **Track applications**: Link practices to real job applications
4. **Adjust settings**: Fine-tune AI behavior to your needs
5. **Export data**: Backup your progress regularly

## Getting Help

- Check the full **README.md** for detailed information
- Review **ARCHITECTURE.md** for technical details
- Open an issue on GitHub for bugs or feature requests

## Production Build

When ready to create a production build:

```bash
# Build the application
npm run build
npm run build:electron

# Find installers in dist/ folder
```

---

**Happy practicing! Good luck with your interviews! 🚀**
