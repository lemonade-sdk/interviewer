import { AgentPersona, InterviewStyle, InterviewType } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * PersonaGeneratorService
 * 
 * Analyzes uploaded documents (Job Description + Resume) and auto-generates
 * a tailored interviewer persona. The flow:
 * 
 *   1. Read & deeply comprehend the Job Description
 *   2. Read & deeply comprehend the Candidate's Resume
 *   3. Synthesize both to produce a calibrated interviewer persona
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
}

export class PersonaGeneratorService {
  private lemonadeClient: LemonadeClient;

  constructor(lemonadeClient: LemonadeClient) {
    this.lemonadeClient = lemonadeClient;
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

    return `You are an expert interview preparation system. Analyze the job description and resume below, then generate a tailored interviewer persona as a JSON object.

<JOB_DESCRIPTION>
${jd}
</JOB_DESCRIPTION>

<RESUME>
${resume}
</RESUME>

Interview type: ${input.interviewType}
Company: ${input.company}
Position: ${input.position}

Respond with ONLY a valid JSON object (no markdown, no explanation) with these fields:

{
  "name": "Realistic interviewer name",
  "description": "1-2 sentence description of the interviewer",
  "interviewStyle": "conversational | formal | challenging | supportive",
  "questionDifficulty": "easy | medium | hard",
  "systemPrompt": "200-400 word instruction prompt for the interviewer (include: interviewer identity, role context, candidate strengths & gaps from resume, key questions to ask, evaluation criteria, behavioral guidelines — ask one question at a time, be ${input.interviewType === 'behavioral' ? 'warm and encouraging' : 'professionally rigorous'})",
  "jobAnalysis": "3-5 sentence summary of the job requirements",
  "resumeAnalysis": "3-5 sentence summary of the candidate's fit"
}`;
  }

  /**
   * Generate an interviewer persona from job description and resume.
   */
  async generatePersona(input: PersonaGenerationInput): Promise<GeneratedPersonaResult> {
    const prompt = this.buildPersonaGenerationPrompt(input);

    // Send to the LLM
    const response = await this.lemonadeClient.sendMessage([
      {
        id: 'persona-gen-system',
        role: 'system',
        content: 'You are a JSON generation assistant. You ONLY output valid JSON objects. No markdown, no code fences, no explanations.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'persona-gen-user',
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Parse the response
    const parsed = this.parsePersonaResponse(response, input);
    return parsed;
  }

  /**
   * Parse the LLM response into a structured persona result.
   * Includes robust fallback handling for malformed JSON.
   */
  private parsePersonaResponse(
    response: string,
    input: PersonaGenerationInput,
  ): GeneratedPersonaResult {
    let parsed: any;

    try {
      // Try direct JSON parse first
      parsed = JSON.parse(response);
    } catch {
      // Try to extract JSON from markdown code fences
      const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          // Last resort: try to find JSON object boundaries
          const startIdx = response.indexOf('{');
          const endIdx = response.lastIndexOf('}');
          if (startIdx !== -1 && endIdx > startIdx) {
            try {
              parsed = JSON.parse(response.slice(startIdx, endIdx + 1));
            } catch {
              parsed = null;
            }
          }
        }
      }
    }

    // If parsing completely failed, generate a fallback persona
    if (!parsed) {
      return this.buildFallbackPersona(input, response);
    }

    // Validate and normalize fields
    const validStyles: InterviewStyle[] = ['conversational', 'formal', 'challenging', 'supportive'];
    const validDifficulties = ['easy', 'medium', 'hard'] as const;

    const now = new Date().toISOString();
    const persona: AgentPersona = {
      id: uuidv4(),
      name: typeof parsed.name === 'string' ? parsed.name : `${input.company} Interviewer`,
      description: typeof parsed.description === 'string'
        ? parsed.description
        : `Interviewer for the ${input.position} role at ${input.company}`,
      systemPrompt: typeof parsed.systemPrompt === 'string'
        ? parsed.systemPrompt
        : this.buildFallbackSystemPrompt(input),
      interviewStyle: validStyles.includes(parsed.interviewStyle)
        ? parsed.interviewStyle
        : 'conversational',
      questionDifficulty: validDifficulties.includes(parsed.questionDifficulty)
        ? parsed.questionDifficulty
        : 'medium',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    return {
      persona,
      jobAnalysis: typeof parsed.jobAnalysis === 'string'
        ? parsed.jobAnalysis
        : 'Job description analyzed successfully.',
      resumeAnalysis: typeof parsed.resumeAnalysis === 'string'
        ? parsed.resumeAnalysis
        : 'Resume analyzed successfully.',
    };
  }

  /**
   * Build a fallback persona when LLM response parsing fails entirely.
   */
  private buildFallbackPersona(
    input: PersonaGenerationInput,
    _rawResponse: string,
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
    };
  }

  /**
   * Build a fallback system prompt that still incorporates the documents.
   */
  private buildFallbackSystemPrompt(input: PersonaGenerationInput): string {
    return `You are an experienced interviewer conducting a ${input.interviewType} interview for the position of ${input.position} at ${input.company}.

You have thoroughly reviewed the job description and the candidate's resume.

JOB DESCRIPTION CONTEXT:
${input.jobDescriptionText.slice(0, 2000)}

CANDIDATE RESUME CONTEXT:
${input.resumeText.slice(0, 2000)}

INTERVIEW GUIDELINES:
1. Begin with a warm, professional greeting. Introduce yourself and the interview format.
2. Ask questions that are specifically tailored to this role and this candidate's background.
3. Probe areas where the candidate's experience aligns with the job requirements to validate depth.
4. Explore potential gaps between the candidate's experience and the role's requirements.
5. Ask one question at a time and listen carefully to responses.
6. Provide natural follow-up questions based on the candidate's answers.
7. Maintain a professional, ${input.interviewType === 'behavioral' ? 'supportive' : 'balanced'} tone throughout.
8. Wrap up the interview naturally after covering the key areas.
9. Give the candidate an opportunity to ask questions at the end.`;
  }
}
