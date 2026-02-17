import { AgentPersona, InterviewType } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { StructuredExtractionService } from './StructuredExtractionService';
import { v4 as uuidv4 } from 'uuid';
import { PromptManager } from './PromptManager';

/**
 * PersonaGeneratorService
 * 
 * Analyzes uploaded documents (Job Description + Resume) and auto-generates
 * a tailored interviewer persona using a two-stage approach:
 * 
 * Stage 1: Generate natural language persona description and analysis
 * Stage 2: Extract structured persona fields from the natural text
 * 
 * The generated persona includes a rich system prompt that encapsulates all
 * document knowledge so the interview AI doesn't need to re-read documents.
 */

export interface PersonaGenerationInput {
  jobDescriptionText: string;
  resumeText: string;
  interviewType: InterviewType;
  company: string;
  position: string;
}

export interface GeneratedPersonaResult {
  persona: AgentPersona;
  jobAnalysis: string;
  resumeAnalysis: string;
  rawText?: string; // Natural language output from Stage 1
}

export class PersonaGeneratorService {
  private lemonadeClient: LemonadeClient;
  private extractionService: StructuredExtractionService;

  constructor(lemonadeClient: LemonadeClient) {
    this.lemonadeClient = lemonadeClient;
    this.extractionService = new StructuredExtractionService(lemonadeClient);
  }

  /* ── Token-budget safety ──
   * Small local models typically load with 4-16K context.  The prompt
   * template itself is ~600 tokens, so we cap each document at ~4000
   * characters (~1000-1200 tokens) to stay safely within a 4K window
   * while still leaving room for the model's output.  When the context
   * is larger (16K+), truncation is rarely hit because real JDs/resumes
   * seldom exceed 4K chars.
   */
  private static readonly MAX_DOC_CHARS = 4000;

  private truncate(text: string, maxChars: number = PersonaGeneratorService.MAX_DOC_CHARS): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n[...truncated for length]';
  }

  /**
   * The master prompt that instructs the AI to:
   * 1. Analyze the job description
   * 2. Analyze the resume
   * 3. Generate a complete interviewer persona
   *
   * Kept concise to fit within small-model context windows (4K-16K).
   */
  private buildPersonaGenerationPrompt(input: PersonaGenerationInput): string {
    const jd = this.truncate(input.jobDescriptionText);
    const resume = this.truncate(input.resumeText);
    
    const styleInstruction = input.interviewType === 'behavioral' ? 'warm and encouraging' : 'professionally rigorous';

    return PromptManager.getInstance().getPersonaGenerationUserPrompt({
      jobDescription: jd,
      resume: resume,
      interviewType: input.interviewType,
      company: input.company,
      position: input.position,
      styleInstruction
    });
  }

  /**
   * Generate an interviewer persona from job description and resume.
   * Uses two-stage approach: natural language generation → structured extraction.
   */
  async generatePersona(input: PersonaGenerationInput): Promise<GeneratedPersonaResult> {
    const prompt = this.buildPersonaGenerationPrompt(input);

    // Stage 1: Generate natural language persona description
    const personaText = await this.lemonadeClient.sendMessage([
      {
        id: 'persona-gen-system',
        role: 'system',
        content: PromptManager.getInstance().getPersonaGenerationSystemPrompt(),
        timestamp: new Date().toISOString(),
      },
      {
        id: 'persona-gen-user',
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ], { maxTokens: 8192 });

    // Stage 2: Extract structured persona fields
    const extracted = await this.extractionService.extractPersonaData(personaText);

    // If extraction failed, use fallback with natural text
    if (!extracted) {
      return this.buildFallbackPersona(input, personaText);
    }

    // Build the persona from extracted data
    const now = new Date().toISOString();
    const persona: AgentPersona = {
      id: uuidv4(),
      name: extracted.name,
      description: extracted.description,
      systemPrompt: extracted.systemPrompt,
      interviewStyle: extracted.interviewStyle,
      questionDifficulty: extracted.questionDifficulty,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    return {
      persona,
      jobAnalysis: extracted.jobAnalysis,
      resumeAnalysis: extracted.resumeAnalysis,
      rawText: personaText, // Store the natural language output
    };
  }

  /**
   * Build a fallback persona when extraction fails entirely.
   * Uses the natural text from Stage 1 to create a basic persona.
   */
  private buildFallbackPersona(
    input: PersonaGenerationInput,
    rawResponse: string,
  ): GeneratedPersonaResult {
    const now = new Date().toISOString();
    return {
      persona: {
        id: uuidv4(),
        name: `${input.company} Interviewer`,
        description: `Interviewer for the ${input.position} role at ${input.company}`,
        systemPrompt: this.buildFallbackSystemPrompt(input),
        interviewStyle: 'conversational',
        questionDifficulty: 'medium',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      },
      jobAnalysis: 'The job description was processed but structured analysis could not be extracted.',
      resumeAnalysis: 'The resume was processed but structured analysis could not be extracted.',
      rawText: rawResponse, // Keep the natural text for reference
    };
  }

  /**
   * Build a fallback system prompt that still incorporates the documents.
   */
  private buildFallbackSystemPrompt(input: PersonaGenerationInput): string {
    const toneInstruction = input.interviewType === 'behavioral' ? 'supportive' : 'balanced';

    return PromptManager.getInstance().getPersonaGenerationFallbackPrompt({
      interviewType: input.interviewType,
      position: input.position,
      company: input.company,
      jobDescription: input.jobDescriptionText.slice(0, 2000),
      resume: input.resumeText.slice(0, 2000),
      toneInstruction
    });
  }
}
