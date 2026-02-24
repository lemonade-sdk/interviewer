import { LemonadeClient } from './LemonadeClient';
import { InterviewStyle, InterviewType } from '../types';
import { Message } from '../types';
import { PromptManager } from './PromptManager';

/**
 * StructuredExtractionService - Stage 2 extraction service
 * 
 * Takes natural language text from LLMs (Stage 1) and extracts
 * structured data using specialized extraction prompts (Stage 2).
 * 
 * Key principles:
 * - Uses small, fast models for extraction (Llama-3.2-1B, Qwen-0.5B)
 * - Internal JSON parsing (not user-facing)
 * - Graceful degradation: returns null on failure, preserving natural text
 * - Extraction prompts are tuned independently from generation prompts
 */
export class StructuredExtractionService {
  private lemonadeClient: LemonadeClient;
  private extractionModel: string;

  constructor(lemonadeClient: LemonadeClient, extractionModel?: string) {
    this.lemonadeClient = lemonadeClient;
    // Default to smallest/fastest available model for extraction
    // Can be overridden for specific use cases
    this.extractionModel = extractionModel || 'Qwen2.5-0.5B-Instruct-Hybrid';
  }

  /**
   * Extract structured feedback data from natural language feedback text.
   * 
   * @param feedbackText - Natural language feedback from Stage 1
   * @returns Structured feedback data or null if extraction fails
   */
  async extractFeedbackData(feedbackText: string): Promise<{
    overallScore: number | null;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  } | null> {
    try {
      const extractionPrompt = PromptManager.getInstance().getFeedbackExtractionUserPrompt({
        feedbackText
      });
      
      const messages: Message[] = [
        {
          id: 'extract-system',
          role: 'system',
          content: PromptManager.getInstance().getFeedbackExtractionSystemPrompt(),
          timestamp: new Date().toISOString(),
        },
        {
          id: 'extract-user',
          role: 'user',
          content: extractionPrompt,
          timestamp: new Date().toISOString(),
        },
      ];

      const response = await this.lemonadeClient.sendMessage(messages, {
        maxTokens: 2048,
      });

      console.log('[StructuredExtractionService] Feedback extraction raw response:', response.substring(0, 500));

      // Parse the JSON response
      const parsed = this.parseJSON(response);
      if (!parsed) {
        console.error('[StructuredExtractionService] Failed to parse feedback JSON from response');
        return null;
      }

      console.log('[StructuredExtractionService] Parsed feedback data:', {
        overallScore: parsed.overallScore,
        strengthsCount: parsed.strengths?.length ?? 0,
        weaknessesCount: parsed.weaknesses?.length ?? 0,
        suggestionsCount: parsed.suggestions?.length ?? 0,
      });

      return {
        overallScore: typeof parsed.overallScore === 'number' 
          ? Math.max(0, Math.min(100, parsed.overallScore))
          : null,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (error) {
      console.error('Failed to extract feedback data:', error);
      return null;
    }
  }

  /**
   * Extract structured grade data from natural language question feedback.
   * 
   * @param questionText - The interview question
   * @param answerText - The candidate's answer
   * @param feedbackText - Natural language feedback from Stage 1
   * @returns Structured grade data or null if extraction fails
   */
  async extractQuestionGrade(
    questionText: string,
    answerText: string,
    feedbackText: string
  ): Promise<{
    score: number;
    rating: 'excellent' | 'good' | 'needs-improvement';
    strengths: string[];
    improvements: string[];
    suggestedAnswer: string;
  } | null> {
    try {
      const extractionPrompt = PromptManager.getInstance().getQuestionGradeExtractionUserPrompt({
        question: questionText,
        answer: answerText,
        feedbackText
      });

      const messages: Message[] = [
        {
          id: 'extract-system',
          role: 'system',
          content: PromptManager.getInstance().getQuestionGradeExtractionSystemPrompt(),
          timestamp: new Date().toISOString(),
        },
        {
          id: 'extract-user',
          role: 'user',
          content: extractionPrompt,
          timestamp: new Date().toISOString(),
        },
      ];

      const response = await this.lemonadeClient.sendMessage(messages, {
        maxTokens: 1024,
      });

      const parsed = this.parseJSON(response);
      if (!parsed) return null;

      // Validate and normalize
      const score = typeof parsed.score === 'number' 
        ? Math.max(0, Math.min(100, parsed.score))
        : 50;

      let rating: 'excellent' | 'good' | 'needs-improvement' = 'good';
      if (score >= 80) rating = 'excellent';
      else if (score < 50) rating = 'needs-improvement';

      return {
        score,
        rating: parsed.rating || rating,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        suggestedAnswer: typeof parsed.suggestedAnswer === 'string' 
          ? parsed.suggestedAnswer 
          : '',
      };
    } catch (error) {
      console.error('Failed to extract question grade:', error);
      return null;
    }
  }

  /**
   * Extract structured persona data from natural language persona description.
   * 
   * @param personaText - Natural language persona description from Stage 1
   * @returns Structured persona data or null if extraction fails
   */
  async extractPersonaData(personaText: string): Promise<{
    name: string;
    description: string;
    interviewStyle: InterviewStyle;
    questionDifficulty: 'easy' | 'medium' | 'hard';
    systemPrompt: string;
    jobAnalysis: string;
    resumeAnalysis: string;
  } | null> {
    try {
      const extractionPrompt = PromptManager.getInstance().getPersonaExtractionUserPrompt({
        personaText
      });

      const messages: Message[] = [
        {
          id: 'extract-system',
          role: 'system',
          content: PromptManager.getInstance().getPersonaExtractionSystemPrompt(),
          timestamp: new Date().toISOString(),
        },
        {
          id: 'extract-user',
          role: 'user',
          content: extractionPrompt,
          timestamp: new Date().toISOString(),
        },
      ];

      const response = await this.lemonadeClient.sendMessage(messages, {
        maxTokens: 8192,
      });

      console.log('[StructuredExtractionService] Persona extraction raw response:', response.substring(0, 500));

      const parsed = this.parseJSON(response);
      if (!parsed) {
        console.error('[StructuredExtractionService] Failed to parse persona JSON from response');
        return null;
      }

      console.log('[StructuredExtractionService] Parsed persona data:', {
        name: parsed.name,
        hasDescription: !!parsed.description,
        interviewStyle: parsed.interviewStyle,
        questionDifficulty: parsed.questionDifficulty,
        hasSystemPrompt: !!parsed.systemPrompt,
        hasJobAnalysis: !!parsed.jobAnalysis,
        hasResumeAnalysis: !!parsed.resumeAnalysis,
      });

      // Validate interview style
      const validStyles: InterviewStyle[] = ['conversational', 'formal', 'challenging', 'supportive'];
      const interviewStyle = validStyles.includes(parsed.interviewStyle)
        ? parsed.interviewStyle
        : 'conversational';

      // Validate difficulty
      const validDifficulties = ['easy', 'medium', 'hard'];
      const questionDifficulty = validDifficulties.includes(parsed.questionDifficulty)
        ? parsed.questionDifficulty
        : 'medium';

      return {
        name: typeof parsed.name === 'string' ? parsed.name : 'Interviewer',
        description: typeof parsed.description === 'string' ? parsed.description : '',
        interviewStyle,
        questionDifficulty,
        systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
        jobAnalysis: typeof parsed.jobAnalysis === 'string' ? parsed.jobAnalysis : '',
        resumeAnalysis: typeof parsed.resumeAnalysis === 'string' ? parsed.resumeAnalysis : '',
      };
    } catch (error) {
      console.error('Failed to extract persona data:', error);
      return null;
    }
  }

  /**
   * Extract structured job details from job posting analysis.
   * 
   * @param jobPostingText - Original job posting text
   * @param analysisText - Natural language analysis from Stage 1
   * @returns Structured job details or null if extraction fails
   */
  async extractJobDetails(
    jobPostingText: string,
    analysisText: string
  ): Promise<{
    title: string;
    company: string;
    position: string;
    interviewType: InterviewType;
  } | null> {
    try {
      const extractionPrompt = PromptManager.getInstance().getJobDetailsExtractionUserPrompt({
        jobText: jobPostingText.substring(0, 2000), // Truncate for efficiency
        analysisText
      });

      const messages: Message[] = [
        {
          id: 'extract-system',
          role: 'system',
          content: PromptManager.getInstance().getJobDetailsExtractionSystemPrompt(),
          timestamp: new Date().toISOString(),
        },
        {
          id: 'extract-user',
          role: 'user',
          content: extractionPrompt,
          timestamp: new Date().toISOString(),
        },
      ];

      const response = await this.lemonadeClient.sendMessage(messages, {
        maxTokens: 512,
      });

      const parsed = this.parseJSON(response);
      if (!parsed) return null;

      // Validate interview type
      const validTypes: InterviewType[] = [
        'general',
        'technical',
        'behavioral',
        'system-design',
        'coding',
        'mixed',
      ];
      const interviewType = validTypes.includes(parsed.interviewType)
        ? parsed.interviewType
        : 'general';

      return {
        title: typeof parsed.title === 'string' ? parsed.title : 'Interview',
        company: typeof parsed.company === 'string' ? parsed.company : 'Company',
        position: typeof parsed.position === 'string' ? parsed.position : 'Position',
        interviewType,
      };
    } catch (error) {
      console.error('Failed to extract job details:', error);
      return null;
    }
  }

  /**
   * Parse JSON with multiple fallback strategies.
   * Similar to old approach but used ONLY in extraction service (Stage 2).
   * 
   * @param response - LLM response that should contain JSON
   * @returns Parsed object or null
   */
  private parseJSON(response: string): any {
    if (!response) return null;

    const cleaned = response.trim();

    // Layer 1: Direct JSON parse
    try {
      return JSON.parse(cleaned);
    } catch {
      // Continue to fallbacks
    }

    // Layer 2: Strip markdown code fences
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        // Continue to next fallback
      }
    }

    // Layer 3: Find JSON object boundaries
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
      } catch {
        // All fallbacks failed
      }
    }

    return null;
  }

  /**
   * Set the extraction model.
   * Allows switching to different models for specific use cases.
   */
  setExtractionModel(modelName: string): void {
    this.extractionModel = modelName;
  }

  /**
   * Get the current extraction model name.
   */
  getExtractionModel(): string {
    return this.extractionModel;
  }
}
