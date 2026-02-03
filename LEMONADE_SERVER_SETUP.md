# Complete Setup Guide: AI Interviewer with Lemonade Server

## 🎯 What You're Building

An AI-powered interview practice application that runs **100% locally** on your computer. No cloud APIs, no costs, complete privacy.

## 📦 Step-by-Step Setup

### Step 1: Install Prerequisites

#### 1.1 Install Node.js
- Download from [nodejs.org](https://nodejs.org/)
- Version 18 or higher required
- Verify: `node --version`

#### 1.2 Install Lemonade Server
- Visit [https://lemonade-server.ai/docs/](https://lemonade-server.ai/docs/)
- Download the one-click Windows installer
- Run the installer
- Lemonade Server will be installed and accessible via command line

### Step 2: Set Up Lemonade Server

#### 2.1 Download a Model
```bash
# Recommended for beginners (fast, lightweight)
lemonade-server pull Llama-3.2-1B-Instruct-Hybrid

# Alternative: Better quality, more resources needed
lemonade-server pull Llama-3.2-3B-Instruct-Hybrid

# Alternative: High quality, balanced
lemonade-server pull Phi-3.5-mini-instruct-Hybrid
```

**Note**: Model download may take 5-15 minutes depending on internet speed.

#### 2.2 Start Lemonade Server
```bash
lemonade-server start
```

You should see output like:
```
Lemonade Server starting on port 8000...
Server ready at http://localhost:8000
```

#### 2.3 Verify Server is Running
Visit http://localhost:8000/api/v1/health in your browser. You should see a health check response.

### Step 3: Install AI Interviewer

#### 3.1 Get the Code
```bash
git clone <repository-url>
cd interviewer
```

#### 3.2 Install Dependencies
```bash
npm install
```

This installs all required packages including:
- Electron
- React
- OpenAI client (for Lemonade Server)
- TypeScript
- Tailwind CSS
- And more...

#### 3.3 Start the Application
```bash
npm run dev
```

The application will:
1. Check if Lemonade Server is running
2. Connect to http://localhost:8000
3. Launch the Electron window
4. Open developer tools (in dev mode)

### Step 4: Configure the Application

#### 4.1 Check Server Connection
1. In AI Interviewer, go to **Settings** (sidebar)
2. Click **Interviewer AI** tab
3. Check the **Lemonade Server Status** box at the top
4. Should show: **"✓ Connected to Lemonade Server at http://localhost:8000"**

#### 4.2 Select Model
1. In the same Settings → Interviewer AI page
2. Click **"Refresh Models"** button
3. Available models will populate the dropdown
4. Select your preferred model (e.g., "Llama-3.2-1B-Instruct-Hybrid")
5. Click **"Save Changes"**

#### 4.3 Adjust Interview Settings (Optional)
- **Interview Style**: Conversational, Formal, Challenging, or Supportive
- **Question Difficulty**: Easy, Medium, or Hard
- **Number of Questions**: 5-20 recommended
- **Temperature**: 0.5-0.9 (lower = more focused, higher = more creative)
- **Max Tokens**: 500-2000 (affects response length)

### Step 5: Run Your First Interview

#### 5.1 Create Interview
1. Go to **Dashboard**
2. Click **"New Interview"**
3. Fill in:
   - **Interview Title**: e.g., "Senior Developer Practice"
   - **Company**: e.g., "Tech Corp"
   - **Position**: e.g., "Senior Software Engineer"
   - **Interview Type**: Choose one (Technical, Behavioral, etc.)
4. Click **"Start Interview"**

#### 5.2 Conduct Interview
1. Read the AI's greeting
2. Type your response in the message box
3. Press **Enter** or click **"Send"**
4. Continue the conversation naturally
5. Answer questions thoughtfully as you would in a real interview

#### 5.3 End Interview
1. Click **"End Interview"** when ready to finish
2. Confirm the action
3. View your comprehensive feedback:
   - Overall score
   - Strengths
   - Areas for improvement
   - Specific suggestions
   - Full transcript

### Step 6: Track Your Progress

#### 6.1 Review Interview History
1. Go to **Interview History** (sidebar)
2. Browse past interviews
3. Search by company, position, or title
4. Click **"View Details"** to see full transcript and feedback

#### 6.2 Manage Job Applications
1. Go to **Job Applications** (sidebar)
2. Click **"Add Job"** to track applications
3. Link interviews to specific jobs
4. Update status as you progress through the hiring process

## 🔧 Troubleshooting

### Issue: "Cannot connect to Lemonade Server"

**Cause**: Lemonade Server is not running or not accessible

**Solutions**:
1. Start Lemonade Server:
   ```bash
   lemonade-server start
   ```
2. Check if port 8000 is available:
   ```bash
   netstat -ano | findstr :8000
   ```
3. Try visiting http://localhost:8000/api/v1/health in browser
4. Check Windows Firewall settings

### Issue: "Model 'X' not found"

**Cause**: The selected model is not loaded in Lemonade Server

**Solutions**:
1. Pull the model:
   ```bash
   lemonade-server pull Llama-3.2-1B-Instruct-Hybrid
   ```
2. Load the model:
   ```bash
   lemonade-server load Llama-3.2-1B-Instruct-Hybrid
   ```
3. Refresh models in AI Interviewer Settings
4. Select the model from dropdown

### Issue: Slow AI Responses

**Causes & Solutions**:

| Cause | Solution |
|-------|----------|
| Large model | Use smaller model (1B instead of 3B) |
| High max_tokens | Reduce to 500-1000 in Settings |
| Low GPU memory | Close other applications |
| CPU-only mode | Check Lemonade Server is using NPU/GPU |

### Issue: Application Won't Start

**Solutions**:
1. Clear and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Check Node.js version: `node --version` (must be 18+)
3. Check for port conflicts (default: 5173 for dev server)

## 🎓 Best Practices

### Model Selection
- **Start Small**: Use 1B model first to verify everything works
- **Upgrade Gradually**: Try 3B models once comfortable
- **Monitor Resources**: Check CPU/GPU/memory usage

### Interview Practice
- **Be Realistic**: Answer as you would in real interviews
- **Take Notes**: Review feedback after each session
- **Practice Regularly**: Schedule regular practice sessions
- **Vary Types**: Mix technical, behavioral, and other interview types

### System Management
- **Keep Server Running**: Leave Lemonade Server running while using the app
- **Update Models**: Check for new/updated models periodically
- **Backup Data**: SQLite database is in user data folder - back it up
- **Monitor Disk Space**: Models can be 1-5GB each

## 🚀 Advanced Tips

### Running Multiple Models
```bash
# Pull multiple models for different scenarios
lemonade-server pull Llama-3.2-1B-Instruct-Hybrid  # Fast responses
lemonade-server pull Llama-3.2-3B-Instruct-Hybrid  # Better quality
lemonade-server pull Phi-3.5-mini-instruct-Hybrid  # Balanced

# Switch between them in Settings
```

### Custom Server Port
If you need to run Lemonade Server on a different port:

1. Start server on custom port:
   ```bash
   lemonade-server start --port 8001
   ```

2. Update `src/services/LemonadeClient.ts`:
   ```typescript
   private baseURL: string = 'http://localhost:8001/api/v1';
   ```

### Performance Optimization
1. **Lower Temperature** (0.5-0.6) for consistent, focused responses
2. **Reduce Max Tokens** (500-800) for faster generation
3. **Use System Prompt** efficiently - it's already optimized
4. **Close DevTools** in production for better performance

## 📊 System Requirements

### Minimum
- Windows 10+
- 8GB RAM
- 4GB free disk space
- Intel CPU with NPU support (or GPU)

### Recommended
- Windows 11
- 16GB RAM
- 10GB free disk space
- Intel NPU or dedicated GPU
- SSD for better performance

## 🔄 Daily Workflow

1. **Start Lemonade Server** (if not already running)
2. **Launch AI Interviewer**
3. **Check server status** in Settings
4. **Start practicing interviews**
5. **Review feedback** after each session
6. **Track progress** in Interview History

## 📚 Resources

- **This Project**: Complete AI Interviewer application
- **Lemonade Server**: https://lemonade-server.ai/docs/
- **Model List**: Check Lemonade Server documentation
- **Support**: Open issues on GitHub

## ✅ Checklist

Before your first interview, make sure:

- [ ] Node.js 18+ installed
- [ ] Lemonade Server installed
- [ ] At least one model downloaded
- [ ] Lemonade Server running on port 8000
- [ ] AI Interviewer dependencies installed (`npm install`)
- [ ] Application starts without errors (`npm run dev`)
- [ ] Server status shows "Connected" in Settings
- [ ] Model selected in Settings
- [ ] Settings saved

## 🎉 You're Ready!

Everything is set up! You can now:
- Practice unlimited interviews
- Get AI-powered feedback
- Track your progress
- Improve your interview skills

All running locally on your machine with complete privacy! 🔒

---

**Need Help?** Check the main [README.md](README.md), [QUICKSTART.md](QUICKSTART.md), or [LEMONADE_SERVER_INTEGRATION.md](LEMONADE_SERVER_INTEGRATION.md)
