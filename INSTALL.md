# Installation & Setup Instructions

## System Requirements

- **Operating System**: Windows 10+, macOS 10.13+, or Linux
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 500MB for application + dependencies

## Step-by-Step Installation

### 1. Install Node.js

If you don't have Node.js installed:

**Windows:**
1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Verify installation:
```cmd
node --version
npm --version
```

**macOS:**
```bash
# Using Homebrew
brew install node

# Verify installation
node --version
npm --version
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Verify installation
node --version
npm --version
```

### 2. Clone or Download the Project

**Option A: Using Git**
```bash
git clone <repository-url>
cd interviewer
```

**Option B: Download ZIP**
1. Download the project ZIP file
2. Extract to your desired location
3. Open terminal/command prompt in that folder

### 3. Install Dependencies

```bash
npm install
```

This will install all required packages:
- Electron
- React and React Router
- TypeScript
- Tailwind CSS
- SQLite database
- All other dependencies

**Note**: Installation may take 3-5 minutes depending on your internet connection.

### 4. Optional: Configure Environment

If you want to use real AI models (not the MVP mock responses):

1. Copy the environment template:
```bash
# Windows
copy .env.example.txt .env

# macOS/Linux
cp .env.example.txt .env
```

2. Edit `.env` and add your API keys:
```env
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

**Note**: The application works with mock responses by default, so this step is optional for testing.

## Running the Application

### Development Mode

Start the application in development mode with hot reloading:

```bash
npm run dev
```

This will:
1. Start the Vite development server
2. Launch the Electron application
3. Enable hot module reloading
4. Open developer tools automatically

### Production Build

To create a production build:

```bash
# Build the React application
npm run build

# Package the Electron application
npm run build:electron
```

Installers will be created in the `dist/` folder:
- **Windows**: `.exe` installer
- **macOS**: `.dmg` installer
- **Linux**: `.AppImage` file

## First Run

When you first start the application:

1. **Database Creation**: A SQLite database is automatically created
2. **Default Settings**: Sensible defaults are configured
3. **Welcome Screen**: You'll see the Dashboard

No additional configuration is needed to start practicing!

## Troubleshooting Installation

### Problem: npm install fails

**Solution 1**: Clear npm cache
```bash
npm cache clean --force
npm install
```

**Solution 2**: Delete and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: Python/build tools error (Windows)

**Solution**: Install Windows Build Tools
```bash
npm install --global windows-build-tools
```

### Problem: Permission denied (macOS/Linux)

**Solution**: Don't use sudo with npm. Fix permissions:
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Problem: SQLite installation fails

**Solution**: Install build dependencies

**Windows**: Install Visual Studio Build Tools

**macOS**:
```bash
xcode-select --install
```

**Linux**:
```bash
sudo apt-get install build-essential python3
```

### Problem: Electron download fails

**Solution**: Configure a mirror
```bash
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm install
```

## Verifying Installation

After installation, verify everything works:

```bash
# Check if all dependencies are installed
npm list --depth=0

# Try starting the application
npm run dev
```

Expected output:
```
> ai-interviewer@1.0.0 dev
> concurrently "npm run dev:react" "npm run dev:electron"

VITE v5.0.11  ready in 234 ms
➜  Local:   http://localhost:5173/
Database initialized at: [path]
Application initialized successfully
```

## Updating the Application

To update to a newer version:

```bash
# Pull latest changes (if using Git)
git pull

# Update dependencies
npm install

# Restart the application
npm run dev
```

## Uninstalling

To completely remove the application:

1. Delete the project folder
2. Delete the database (optional):
   - **Windows**: `%APPDATA%/ai-interviewer/`
   - **macOS**: `~/Library/Application Support/ai-interviewer/`
   - **Linux**: `~/.config/ai-interviewer/`

## Performance Tips

For the best experience:

1. **Use SSD**: Install on SSD for faster startup
2. **Close Background Apps**: Free up RAM
3. **Update Node.js**: Use the latest LTS version
4. **Disable Antivirus**: Temporarily during npm install (if slow)

## Getting Help

If you encounter issues:

1. Check the **README.md** for usage instructions
2. Review **TROUBLESHOOTING** section in README
3. Search existing GitHub issues
4. Create a new issue with:
   - Your OS and version
   - Node.js version (`node --version`)
   - Error messages
   - Steps to reproduce

## Next Steps

After installation:

1. Read **QUICKSTART.md** for a 5-minute tutorial
2. Start your first interview practice
3. Explore the Settings to customize AI behavior
4. Review **ARCHITECTURE.md** if you want to understand the codebase

---

**Enjoy your interview practice! 🚀**
