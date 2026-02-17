/**
 * TextProcessingService - Unified text cleaning and sanitization utility
 * 
 * Consolidates all text processing logic for:
 * - TTS (Text-to-Speech) preparation
 * - UI display formatting
 * - User input sanitization
 * - LLM response cleaning
 * 
 * Replaces duplicate logic previously in:
 * - LemonadeClient.cleanResponseContent()
 * - VoiceInterviewManager.cleanForTTS()
 */
export class TextProcessingService {
  /**
   * Clean text for Text-to-Speech (TTS) engines.
   * Removes all markdown formatting, code blocks, special characters,
   * and artifacts that would sound unnatural when spoken.
   * 
   * @param text - Raw text that may contain markdown, formatting, etc.
   * @returns Clean text suitable for TTS synthesis
   */
  static cleanForTTS(text: string): string {
    if (!text) return text;

    let cleaned = text;

    // 1. Remove tool-call artifacts (DeepSeek/Qwen3 tokens)
    //    Pattern: <｜tool▁calls▁begin｜> ... <｜tool▁calls▁end｜>
    cleaned = cleaned.replace(
      /<｜tool▁calls▁begin｜>[\s\S]*?<｜tool▁calls▁end｜>/g,
      '',
    );

    // Fallback: remove orphan tool-call markers
    cleaned = cleaned.replace(/<｜tool▁call[s]?▁(?:begin|end)｜>/g, '');
    cleaned = cleaned.replace(/<｜tool▁sep｜>/g, '');

    // 2. Remove code fences with JSON content (from tool calls)
    cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '');

    // 3. Remove all code blocks (```...```)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

    // 4. Remove bold/italic markers
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold** -> bold
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');     // __bold__ -> bold
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');     // *italic* -> italic
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');       // _italic_ -> italic

    // 5. Remove headers (### Header -> Header)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // 6. Remove horizontal rules (---, ***, ___)
    cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '');

    // 7. Remove blockquotes (> text -> text)
    cleaned = cleaned.replace(/^>\s+/gm, '');

    // 8. Convert links to just their text ([text](url) -> text)
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 9. Remove inline code backticks (`code` -> code)
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // 10. Remove numbered list prefixes (1. text -> text)
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '');

    // 11. Remove bullet list prefixes (- text or * text -> text)
    cleaned = cleaned.replace(/^[-*]\s+/gm, '');

    // 12. Normalize whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' '); // Collapse multiple spaces
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines

    return cleaned.trim();
  }

  /**
   * Clean text for display in the UI.
   * Less aggressive than cleanForTTS - may preserve some formatting
   * for better readability while removing problematic artifacts.
   * 
   * @param text - Raw text from LLM or other source
   * @returns Text suitable for UI display
   */
  static cleanForDisplay(text: string): string {
    if (!text) return text;

    let cleaned = text;

    // Remove tool-call artifacts (these are never useful in UI)
    cleaned = cleaned.replace(
      /<｜tool▁calls▁begin｜>[\s\S]*?<｜tool▁calls▁end｜>/g,
      '',
    );
    cleaned = cleaned.replace(/<｜tool▁call[s]?▁(?:begin|end)｜>/g, '');
    cleaned = cleaned.replace(/<｜tool▁sep｜>/g, '');

    // Remove JSON code blocks from tool calls
    cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '');

    // Normalize excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Sanitize user input before sending to LLM.
   * Removes potentially problematic characters and normalizes formatting.
   * 
   * @param text - Raw user input
   * @returns Sanitized text safe for LLM processing
   */
  static sanitizeUserInput(text: string): string {
    if (!text) return text;

    let sanitized = text;

    // Remove null bytes and other control characters (except newlines/tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize Unicode whitespace to standard spaces
    sanitized = sanitized.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ');

    // Collapse excessive whitespace
    sanitized = sanitized.replace(/\s{2,}/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    return sanitized.trim();
  }

  /**
   * Normalize whitespace in text.
   * Collapses multiple spaces and excessive newlines.
   * 
   * @param text - Text with potentially excessive whitespace
   * @returns Text with normalized whitespace
   */
  static normalizeWhitespace(text: string): string {
    if (!text) return text;

    let normalized = text;
    normalized = normalized.replace(/\s{2,}/g, ' '); // Multiple spaces -> single space
    normalized = normalized.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    return normalized.trim();
  }

  /**
   * Remove markdown formatting completely.
   * Converts markdown to plain text by removing all formatting syntax.
   * 
   * @param text - Markdown formatted text
   * @returns Plain text without any markdown syntax
   */
  static stripMarkdown(text: string): string {
    if (!text) return text;

    let plain = text;

    // Remove bold/italic
    plain = plain.replace(/\*\*([^*]+)\*\*/g, '$1');
    plain = plain.replace(/__([^_]+)__/g, '$1');
    plain = plain.replace(/\*([^*]+)\*/g, '$1');
    plain = plain.replace(/_([^_]+)_/g, '$1');

    // Remove headers
    plain = plain.replace(/^#{1,6}\s+/gm, '');

    // Remove horizontal rules
    plain = plain.replace(/^[-*_]{3,}\s*$/gm, '');

    // Remove blockquotes
    plain = plain.replace(/^>\s+/gm, '');

    // Remove links (keep text only)
    plain = plain.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove inline code
    plain = plain.replace(/`([^`]+)`/g, '$1');

    // Remove code blocks
    plain = plain.replace(/```[\s\S]*?```/g, '');

    // Remove images
    plain = plain.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

    // Remove list prefixes
    plain = plain.replace(/^\d+\.\s+/gm, '');
    plain = plain.replace(/^[-*+]\s+/gm, '');

    return this.normalizeWhitespace(plain);
  }
}
