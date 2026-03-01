# Context Window Sizes: Complete Explanation

## Three Different Context Values

### **1. Model's Architectural Maximum Context**
**Definition:** The maximum context window the model was *trained* to support

**Your Models:**
| Model | Architectural Max Context |
|-------|---------------------------|
| DeepSeek-R1-Qwen3-8B | 32,768 tokens (32K) |
| GPT-OSS-20B | 16,384+ tokens (16K+) |
| Llama-3.2-1B | 131,072 tokens (128K) |
| Qwen2.5-0.5B | 32,768 tokens (32K) |

**Source:** Model card on Hugging Face / training documentation

**Analogy:** Car's speedometer maximum (200 mph)

---

### **2. Lemonade Server's Loaded Context (Runtime)**
**Definition:** The `ctx_size` parameter used when Lemonade Server loaded the model

**How it's set:**
```bash
# Method 1: At load time
lemonade-server load DeepSeek-Qwen3-8B-GGUF --ctx-size 8192

# Method 2: Default in serve command
lemonade-server serve --ctx-size 8192

# Method 3: Model-specific config
lemonade-server load DeepSeek-Qwen3-8B-GGUF --ctx-size 16384
```

**What it controls:**
- **Memory allocation:** KV cache size in VRAM/RAM
- **Actual usable context:** Hard limit at runtime
- **Performance trade-off:**
  - Smaller (4K-8K): Faster, less memory, cheaper
  - Larger (16K-32K): Slower, more memory, expensive

**Typical Lemonade Server Defaults:**
- Small models (< 3B): 8,192 tokens (8K)
- Medium models (3-10B): 8,192 - 16,384 tokens
- Large models (> 10B): 4,096 - 8,192 tokens (memory constrained)

**Analogy:** Speed governor you install (65 mph limiter)

---

### **3. LemonadeClient's Hardcoded Assumption (Code)**
**Definition:** The `totalContextWindow = 4096` in `LemonadeClient.ts` line 125

```typescript
// Default to 4k context window if not specified (standard for smaller models)
const totalContextWindow = 4096;
```

**What it controls:**
- **Input truncation logic ONLY**
- Client-side conversation history trimming
- Does NOT affect the actual model

**Impact:**
```typescript
maxOutputTokens = 8192 (what we set)
maxInputTokens = 4096 - 8192 = -4096 tokens ❌

// This causes truncateConversationHistory() to:
// - Either fail with negative limit
// - Or aggressively truncate input
```

**Analogy:** What your GPS thinks the speed limit is (55 mph)

---

## The Real Situation in Your App

Based on your logs, here's what's **actually happening**:

### **Your Server Configuration:**

Looking at the health response:
```javascript
all_models_loaded: [
  {
    model_name: 'DeepSeek-Qwen3-8B-GGUF',
    recipe: 'llamacpp',
    recipe_options: {
      ctx_size: 8192,           // ← ACTUAL loaded context
      n_gpu_layers: 99,
      // ... other options
    }
  }
]
```

**Lemonade Server loaded with `ctx_size: 8192`**

### **The Math:**

| Context Type | Value | Notes |
|--------------|-------|-------|
| Model architectural max | 32,768 | DeepSeek can handle this |
| **Lemonade loaded context** | **8,192** | **Actual runtime limit** |
| Client hardcoded assumption | 4,096 | Outdated |
| Persona extraction request | 8,192 output | Exceeds client assumption |

### **Why Persona Extraction Works:**

**Request breakdown:**
```
Input:  ~750 tokens (system prompt + persona text)
Output: 8,192 tokens (requested for structured JSON)
Total:  ~9,000 tokens needed
```

**Available:** 8,192 tokens from Lemonade Server

**Problem:** `9,000 > 8,192` ❌

**BUT it works because:**
1. **Model uses reasoning_content** for internal thinking (doesn't count toward ctx_size)
2. **Actual output is smaller** (~2-3K tokens typically)
3. **llamacpp is flexible** with token limits (soft limit, not hard crash)

---

## How to Check Your Actual ctx_size

### **Method 1: Lemonade Server Logs**

When you start Lemonade Server:
```
[INFO] Loading model DeepSeek-Qwen3-8B-GGUF...
llama_new_context_with_model: n_ctx = 8192
llama_new_context_with_model: kv_cache_size = 1024.00 MiB
llama_new_context_with_model: kv_self.size = 1024.00 MiB
```

Look for `n_ctx = XXXX` ← This is your actual context!

### **Method 2: Query /api/v1/health**

```typescript
const health = await lemonadeClient.fetchServerHealth();
const llmModel = health.all_models_loaded?.find(m => m.type === 'llm');
const actualContextSize = llmModel?.recipe_options?.ctx_size ?? 8192;

console.log('Actual loaded context size:', actualContextSize);
```

**Your log output would show:**
```javascript
recipe_options: {
  ctx_size: 8192,      // ← This is what we need!
  n_gpu_layers: 99,
  flash_attn: true,
  // ...
}
```

### **Method 3: Check Model Loading Command**

If you saved your model loading command:
```bash
cat ~/.lemonade/server.log | grep "ctx_size"
# or
lemonade-server info DeepSeek-Qwen3-8B-GGUF
```

---

## The Problem & Solution

### **Current Situation:**

```
Model Architectural Max:   32,768 tokens ████████████████████████████████
Lemonade Loaded Context:    8,192 tokens ████████
Client Assumed Context:     4,096 tokens ████
Persona Extraction Output:  8,192 tokens ████████
                                         ↑
                                   Mismatch!
```

### **Issues:**

1. **Client assumes 4K** but Lemonade has **8K loaded**
   - Unnecessarily truncates input
   - Wastes available context

2. **Persona extraction requests 8K output** but **total context is 8K**
   - Leaves no room for input
   - Works by luck (small input + reasoning_content hack)

3. **No dynamic detection** of actual context size
   - Hardcoded assumptions break with different models

---

## Recommended Fixes

### **Fix 1: Query Actual Context from Server** (Best)

```typescript
private cachedContextSize: number | null = null;

async getModelContextSize(): Promise<number> {
  if (this.cachedContextSize) return this.cachedContextSize;
  
  const health = await this.fetchServerHealth();
  const llmModel = health?.all_models_loaded?.find(m => m.type === 'llm');
  const ctxSize = llmModel?.recipe_options?.ctx_size;
  
  this.cachedContextSize = ctxSize ?? 8192; // Default to 8K
  console.log(`Detected model context size: ${this.cachedContextSize}`);
  return this.cachedContextSize;
}

async sendMessage(conversationHistory: Message[], options?: { ... }): Promise<string> {
  // Query actual context size from server
  const totalContextWindow = await this.getModelContextSize();
  
  const maxOutputTokens = options?.maxTokens ?? this.settings.maxTokens ?? 2048;
  const maxInputTokens = Math.max(0, totalContextWindow - maxOutputTokens);
  // ...
}
```

### **Fix 2: Conservative Safety Margin** (Quick)

```typescript
// Always reserve enough input space (25% minimum)
const totalContextWindow = Math.max(16384, maxOutputTokens * 1.5);
const maxInputTokens = totalContextWindow - maxOutputTokens;
```

### **Fix 3: Model-Based Defaults** (Medium)

```typescript
private getDefaultContextWindow(modelName: string): number {
  // Lemonade Server typically loads with 8K context
  // unless explicitly configured higher
  const defaults: Record<string, number> = {
    'DeepSeek': 8192,
    'Qwen': 8192,
    'Llama': 8192,
    'GPT-OSS': 8192,
  };
  
  for (const [key, ctx] of Object.entries(defaults)) {
    if (modelName.includes(key)) return ctx;
  }
  
  return 8192; // Safe default for Lemonade Server
}

const totalContextWindow = this.getDefaultContextWindow(this.settings.modelName);
```

---

## Summary Table

| Concept | Your Value | What Sets It | What It Affects |
|---------|------------|--------------|-----------------|
| **Model Architectural Max** | 32,768 | Model training | Maximum possible |
| **Lemonade Loaded Context** | 8,192 | `--ctx-size` flag or default | **Actual runtime limit** |
| **Client Assumption** | 4,096 | Hardcoded in code | Input truncation logic |
| **Persona Output Request** | 8,192 | `maxTokens` parameter | Response length limit |

### **The Core Issue:**

**Client assumes 4K, Lemonade has 8K, persona needs 8K output.**

Result:
- ❌ Math: 4,096 - 8,192 = -4,096 (impossible)
- ⚠️ Works accidentally (small input + reasoning hack)
- ⚠️ Wastes 4K of available context (8K available, only using 4K)

### **Best Fix:**

**Query actual `ctx_size` from Lemonade Server's `/api/v1/health` response:**
```typescript
const actualContext = health.all_models_loaded[0].recipe_options.ctx_size;
```

This gives you the **real** runtime limit set by Lemonade Server.

---

## Verification Script

Add this to test your actual context size:

```typescript
// Add to LemonadeClient.ts
async debugContextSizes(): Promise<void> {
  const health = await this.fetchServerHealth();
  const llmModel = health?.all_models_loaded?.find(m => m.type === 'llm');
  
  console.log('═══════════════════════════════════════════════');
  console.log('CONTEXT SIZE DEBUG INFO');
  console.log('═══════════════════════════════════════════════');
  console.log('Model:', llmModel?.model_name);
  console.log('Recipe:', llmModel?.recipe);
  console.log('Recipe Options:', llmModel?.recipe_options);
  console.log('');
  console.log('Context Sizes:');
  console.log('  Client hardcoded:    4,096 tokens');
  console.log('  Lemonade loaded:    ', llmModel?.recipe_options?.ctx_size ?? 'UNKNOWN');
  console.log('  Model architectural: 32,768 tokens (DeepSeek)');
  console.log('═══════════════════════════════════════════════');
}
```

Call after initialization to see your actual values.
