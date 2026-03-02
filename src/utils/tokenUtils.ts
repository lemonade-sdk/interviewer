import { Message } from '../types';

/**
 * Approximate token count for a string.
 * Uses a heuristic of ~4 characters per token for English text.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens in a message array.
 */
export function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    // Add tokens for content + some overhead for message structure (role, etc.)
    // Overhead per message is roughly 4 tokens (role, name, etc.)
    return total + estimateTokenCount(msg.content) + 4;
  }, 0);
}

/**
 * Truncate conversation history to fit within a token limit.
 * Preserves the system prompt (first message) and the most recent messages.
 * 
 * @param messages Full conversation history
 * @param maxContextTokens Maximum tokens allowed for context (input)
 * @returns Truncated message array
 */
export function truncateConversationHistory(
  messages: Message[], 
  maxContextTokens: number
): Message[] {
  if (messages.length === 0) return [];

  const totalTokens = calculateTotalTokens(messages);
  if (totalTokens <= maxContextTokens) {
    return messages;
  }

  // Identify system prompt
  const systemPrompt = messages.find(m => m.role === 'system');
  const systemPromptTokens = systemPrompt ? estimateTokenCount(systemPrompt.content) + 4 : 0;
  
  // Reserve space for system prompt
  const availableTokens = maxContextTokens - systemPromptTokens;
  
  if (availableTokens <= 0) {
    // Edge case: System prompt is too large. Return just system prompt (truncated if needed? No, usually critical)
    // or just the last user message if no system prompt.
    // For now, return system prompt and last message if possible, or just last message.
    return systemPrompt ? [systemPrompt] : [messages[messages.length - 1]];
  }

  // Start from the end and add messages until limit is reached
  const reversedHistory = [...messages].reverse();
  const selectedMessages: Message[] = [];
  let currentTokens = 0;

  for (const msg of reversedHistory) {
    if (msg.role === 'system') continue; // Skip system prompt, we'll add it at the end

    const msgTokens = estimateTokenCount(msg.content) + 4;
    
    if (currentTokens + msgTokens <= availableTokens) {
      selectedMessages.unshift(msg);
      currentTokens += msgTokens;
    } else {
      break; // Stop if next message doesn't fit
    }
  }

  // Add system prompt back to the beginning
  if (systemPrompt) {
    selectedMessages.unshift(systemPrompt);
  }

  // console.log(`Context truncated: ${messages.length} -> ${selectedMessages.length} messages. Tokens: ${totalTokens} -> ${calculateTotalTokens(selectedMessages)}`);

  return selectedMessages;
}
