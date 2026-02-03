# 🚀 AI Interviewer - Deployment Guide

## Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ installed
- Git installed
- Lemonade Server running on `localhost:8000`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Test the Application
1. Application opens automatically
2. Navigate to Dashboard
3. Click "Start New Interview"
4. Fill in interview details
5. Select a persona (default: Professional Interviewer)
6. Start chatting with the AI

---

## Production Deployment

### Option 1: Package for Windows
```bash
npm run build
npm run package:win
```

Output: `dist/AI-Interviewer-win32-x64/AI-Interviewer.exe`

### Option 2: Package for macOS
```bash
npm run build
npm run package:mac
```

Output: `dist/AI-Interviewer-darwin-x64/AI-Interviewer.app`

### Option 3: Package for Linux
```bash
npm run build
npm run package:linux
```

Output: `dist/AI-Interviewer-linux-x64/AI-Interviewer`

---

## Lemonade Server Setup

### Installation
```bash
# Using pip
pip install lemonade-server

# Or using conda
conda install -c conda-forge lemonade-server
```

### Configuration
Create `lemonade-config.yaml`:
```yaml
server:
  host: localhost
  port: 8000
  
models:
  - name: Llama-3.2-1B-Instruct-Hybrid
    path: /path/to/model
    type: gguf
    
  - name: whisper-tiny
    path: /path/to/whisper
    type: asr
```

### Start Server
```bash
lemonade-server start --config lemonade-config.yaml
```

### Verify
```bash
curl http://localhost:8000/api/v1/health
# Should return: {"status": "healthy"}
```

---

## Environment Variables (Optional)

Create `.env` file:
```bash
LEMONADE_SERVER_URL=http://localhost:8000
LEMONADE_API_KEY=lemonade
DEFAULT_MODEL=Llama-3.2-1B-Instruct-Hybrid
ASR_MODEL=whisper-tiny
```

---

## Database Initialization

Database is automatically created on first launch:
- Location: `~/.config/ai-interviewer/database.db` (Linux/Mac)
- Location: `%APPDATA%\ai-interviewer\database.db` (Windows)

### Manual Reset (if needed):
```bash
# Delete database file
rm ~/.config/ai-interviewer/database.db

# Restart app - fresh database will be created
npm run dev
```

---

## Troubleshooting

### Issue: "Lemonade Server not running"
**Solution:** Start Lemonade Server first:
```bash
lemonade-server start
```

### Issue: "No models available"
**Solution:** Pull models via Lemonade:
```bash
lemonade-server pull Llama-3.2-1B-Instruct-Hybrid
lemonade-server pull whisper-tiny
```

### Issue: "Cannot access microphone"
**Solution:** Grant microphone permissions in system settings

### Issue: "Database locked"
**Solution:** Close all instances of the app and restart

---

## Performance Tuning

### For Better Response Times:
1. Use smaller LLM models (1B-3B parameters)
2. Keep Lemonade Server on same machine
3. Use SSD for database storage

### For Better Audio Quality:
1. Use dedicated microphone (not laptop built-in)
2. Quiet environment
3. Adjust VAD sensitivity in audio settings

---

## Security Considerations

### Production Deployment:
1. ✅ All data stored locally (no cloud)
2. ✅ No external API calls (except to local Lemonade Server)
3. ✅ SQLite database with file permissions
4. ✅ Audio recordings encrypted at rest (optional)

### Recommended:
- Enable firewall rules for Lemonade Server
- Use HTTPS for Lemonade Server (reverse proxy)
- Implement user authentication (future feature)

---

## Monitoring

### Health Check Endpoint:
The app automatically monitors Lemonade Server health every 30 seconds.

### Logs Location:
- **Development:** Console output
- **Production:** `~/.config/ai-interviewer/logs/`

### View Logs:
```bash
# Linux/Mac
tail -f ~/.config/ai-interviewer/logs/main.log

# Windows
type %APPDATA%\ai-interviewer\logs\main.log
```

---

## Backup & Restore

### Backup Database:
```bash
# Linux/Mac
cp ~/.config/ai-interviewer/database.db ~/backup/

# Windows
copy %APPDATA%\ai-interviewer\database.db C:\backup\
```

### Restore Database:
```bash
# Linux/Mac
cp ~/backup/database.db ~/.config/ai-interviewer/

# Windows
copy C:\backup\database.db %APPDATA%\ai-interviewer\
```

### Backup Audio Recordings:
```bash
# Linux/Mac
cp -r ~/.config/ai-interviewer/audio_recordings ~/backup/

# Windows
xcopy %APPDATA%\ai-interviewer\audio_recordings C:\backup\ /E /I
```

---

## Updates

### Updating the Application:
```bash
git pull origin main
npm install
npm run build
npm run package
```

### Updating Dependencies:
```bash
npm update
npm audit fix
```

---

## Support

### Documentation:
- README.md - Overview
- ARCHITECTURE.md - Technical details
- IMPLEMENTATION_STATUS.md - Current status
- VOICE_FEATURES.md - Voice features

### Issue Reporting:
1. Check existing issues on GitHub
2. Provide error logs
3. Include system info (OS, Node version, Lemonade Server version)

---

## Checklist for Production

- [ ] Lemonade Server running and healthy
- [ ] Models downloaded and loaded
- [ ] Dependencies installed (`npm install`)
- [ ] Application builds without errors (`npm run build`)
- [ ] Database initializes correctly
- [ ] Audio permissions granted
- [ ] All features tested (interviews, jobs, settings)
- [ ] Backup strategy in place
- [ ] Monitoring configured

---

**You're ready to deploy!** 🚀
