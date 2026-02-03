# Lemonade Server Integration Guide

## Overview

AI Interviewer is integrated with **[Lemonade Server](https://lemonade-server.ai/docs/)** - a local LLM server that runs on your machine's NPU and GPU. This provides:

- **100% Privacy**: All AI processing happens locally on your computer
- **No API Costs**: Free unlimited usage with local models
- **No Internet Required**: Works completely offline (after models are downloaded)
- **High Performance**: Optimized for Intel NPU and GPU acceleration

## What is Lemonade Server?

Lemonade Server is a one-click Windows application that:
- Implements the standard OpenAI API specification
- Runs local LLMs on your NPU/GPU
- Provides a REST API at `http://localhost:8000/api/v1`
- Supports models like Llama, Phi, Qwen, and more

## Installation

### 1. Install Lemonade Server

1. Download Lemonade Server from [https://lemonade-server.ai/docs/](https://lemonade-server.ai/docs/)
2. Run the one-click Windows GUI installer
3. Launch Lemonade Server (it will start on port 8000)

### 2. Download a Model

Using the Lemonade Server CLI:

```bash
# List available models
lemonade-server list

# Download a model (recommended for beginners)
lemonade-server pull Llama-3.2-1B-Instruct-Hybrid

# Or download other models
lemonade-server pull Phi-3.5-mini-instruct-Hybrid
lemonade-server pull Llama-3.2-3B-Instruct-Hybrid
```

### 3. Start the Server

```bash
# Start Lemonade Server
lemonade-server start

# Or use the GUI to start the server
```

Verify the server is running by visiting: http://localhost:8000/api/v1/health

## Integration in AI Interviewer

### How It Works

The AI Interviewer application connects to your local Lemonade Server:

```typescript
// The application uses the OpenAI client library
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8000/api/v1',
  apiKey: 'lemonade' // required but unused
});

// Make requests just like with OpenAI
const response = await client.chat.completions.create({
  model: 'Llama-3.2-1B-Instruct-Hybrid',
  messages: [
    { role: 'user', content: 'Tell me about yourself' }
  ]
});
```

### Features Implemented

1. **Automatic Server Detection**
   - Application checks Lemonade Server health on startup
   - Real-time connection monitoring
   - Clear status indicators in Settings

2. **Model Discovery**
   - Automatically fetches available models from server
   - Displays models in Settings dropdown
   - Refresh models button to sync with server

3. **Model Management**
   - Load/unload models via API
   - Pull new models
   - Delete unused models
   - All operations accessible via Settings UI (future enhancement)

4. **Error Handling**
   - Graceful handling when server is not running
   - Clear error messages with actionable guidance
   - Connection retry logic

## Configuration

### Server URL

By default, the application connects to `http://localhost:8000`. If you run Lemonade Server on a different port, you can update it in the code:

```typescript
// In src/services/LemonadeClient.ts
private baseURL: string = 'http://localhost:8000/api/v1';
```

### Model Selection

1. Start Lemonade Server
2. Open AI Interviewer
3. Go to Settings → Interviewer AI
4. Check server status (should show green "Connected")
5. Click "Refresh Models" to fetch available models
6. Select your preferred model from the dropdown
7. Save Changes

## Recommended Models

### For Beginners (Low Resource Usage)
- **Llama-3.2-1B-Instruct-Hybrid** - Best for older hardware
- **Qwen2.5-0.5B-Instruct-Hybrid** - Smallest and fastest

### For Better Quality (Moderate Resource Usage)
- **Llama-3.2-3B-Instruct-Hybrid** - Good balance
- **Phi-3.5-mini-instruct-Hybrid** - High quality responses

### For Best Quality (High Resource Usage)
- Check Lemonade Server documentation for larger models

## API Endpoints Used

AI Interviewer uses these Lemonade Server endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health` | Check server status |
| `GET /api/v1/models` | List available models |
| `POST /api/v1/chat/completions` | Send interview messages |
| `POST /api/v1/load` | Load a model |
| `POST /api/v1/unload` | Unload a model |
| `POST /api/v1/pull` | Download a new model |
| `DELETE /api/v1/delete` | Delete a model |

## Troubleshooting

### Server Not Found

**Error**: "Cannot connect to Lemonade Server"

**Solutions**:
1. Ensure Lemonade Server is running
2. Check it's running on port 8000
3. Visit http://localhost:8000/api/v1/health in browser
4. Check Windows Firewall settings

### Model Not Found

**Error**: "Model 'X' not found"

**Solutions**:
1. Load the model using lemonade-server CLI:
   ```bash
   lemonade-server pull <model-name>
   lemonade-server load <model-name>
   ```
2. Refresh models in AI Interviewer Settings
3. Select the loaded model from dropdown

### Slow Responses

**Solutions**:
1. Use a smaller model (1B or 0.5B)
2. Reduce max_tokens in Settings
3. Close other applications to free up GPU memory
4. Check Lemonade Server logs for performance issues

### Connection Timeout

**Solutions**:
1. Increase timeout in LemonadeClient.ts
2. Check network/firewall settings
3. Restart Lemonade Server
4. Restart AI Interviewer application

## Advanced Usage

### Using Custom Models

If you have custom GGUF models:

1. Place them in Lemonade Server's models directory
2. Use lemonade-server CLI to add them
3. Refresh models in AI Interviewer

### Multiple Server Instances

You can run Lemonade Server on different ports and configure AI Interviewer accordingly:

```typescript
// Update in LemonadeServerManager
const serverManager = new LemonadeServerManager('http://localhost:8001');
```

### Monitoring Performance

Check Lemonade Server logs for:
- Model loading time
- Inference speed (tokens/second)
- Memory usage
- GPU utilization

## Development

### Testing Without Lemonade Server

For development without Lemonade Server running, the application will show appropriate error messages. Consider implementing a mock mode for testing.

### Adding New Endpoints

To use additional Lemonade Server endpoints:

1. Add method to `LemonadeClient.ts`
2. Add IPC handler in `main.js`
3. Expose via `preload.js`
4. Use in UI components

## Performance Tips

1. **Model Selection**: Smaller models = faster responses
2. **Temperature**: Lower values (0.5-0.7) = faster generation
3. **Max Tokens**: Limit to 500-1000 for interviews
4. **Batching**: Not yet implemented, but possible for multiple interviews

## Security Considerations

- Lemonade Server runs locally - no data leaves your machine
- No API keys required (the "lemonade" key is a placeholder)
- All interview data stays on your local disk
- Network traffic is only to localhost

## Resources

- **Lemonade Server Docs**: https://lemonade-server.ai/docs/
- **Model List**: https://lemonade-server.ai/docs/server/server_models/
- **CLI Guide**: https://lemonade-server.ai/docs/server/lemonade-server-cli/
- **Integration Guide**: https://lemonade-server.ai/docs/server/server_integration/

## Support

For issues with:
- **Lemonade Server**: Check their documentation and support channels
- **AI Interviewer Integration**: Open an issue on this project's GitHub

---

**Happy Interviewing with Local AI! 🍋**
