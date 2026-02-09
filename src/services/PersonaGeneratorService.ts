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

  /**
   * The master prompt that instructs the AI to:
   * 1. Analyze the job description
   * 2. Analyze the resume
   * 3. Generate a complete interviewer persona
   */
  private buildPersonaGenerationPrompt(input: PersonaGenerationInput): string {
    return `You are an expert interview preparation system. Your task is to analyze two documents and generate a tailored interviewer persona.

═══════════════════════════════════════════════════════════════
STEP 1: ANALYZE THE JOB DESCRIPTION
═══════════════════════════════════════════════════════════════

Read the following job description carefully. Identify:
- The exact role title and seniority level
- The company's domain/industry
- Required technical skills and qualifications
- Preferred/nice-to-have skills
- Key responsibilities
- Team structure and reporting lines (if mentioned)
- Company culture indicators
- What would make an ideal candidate

<JOB_DESCRIPTION>
${input.jobDescriptionText}
</JOB_DESCRIPTION>

═══════════════════════════════════════════════════════════════
STEP 2: ANALYZE THE CANDIDATE'S RESUME
═══════════════════════════════════════════════════════════════

Now read the candidate's resume. With the job requirements fresh in your mind, identify:
- The candidate's current experience level and career trajectory
- Skills that MATCH the job requirements (strengths to validate)
- Skills that are MISSING or WEAK relative to the job (gaps to probe)
- Notable projects or achievements relevant to this role
- Potential red flags or areas needing clarification
- How well the candidate's background aligns with the role overall

<RESUME>
${input.resumeText}
</RESUME>

═══════════════════════════════════════════════════════════════
STEP 3: GENERATE THE INTERVIEWER PERSONA
═══════════════════════════════════════════════════════════════

Based on your analysis, generate a JSON object for the interviewer persona.

The interview type is: ${input.interviewType}
The company is: ${input.company}
The position is: ${input.position}

Generate the persona as a JSON object with EXACTLY these fields:

{
  "name": "A realistic interviewer name appropriate for the company/industry",
  "description": "A 1-2 sentence description of who this interviewer is (their role, expertise, why they're conducting this interview)",
  "interviewStyle": "One of: conversational, formal, challenging, supportive - choose based on the role seniority and company culture",
  "questionDifficulty": "One of: easy, medium, hard - calibrate based on the role seniority and candidate experience",
  "systemPrompt": "A comprehensive system prompt (see detailed instructions below)",
  "jobAnalysis": "A concise 3-5 sentence summary of what you found in the job description",
  "resumeAnalysis": "A concise 3-5 sentence summary of what you found in the resume and how it maps to the role"
}

CRITICAL INSTRUCTIONS FOR THE "systemPrompt" FIELD:

The systemPrompt is the instruction set that YOU (the AI) will follow during the actual interview.
It must be a self-contained, comprehensive prompt that includes:

1. YOUR IDENTITY: Who you are (name, title, department at the company)
2. THE ROLE CONTEXT: What position you're hiring for, what the team needs, what success looks like
3. CANDIDATE KNOWLEDGE: What you know about this candidate from their resume (reference specific experience, projects, skills)
4. INTERVIEW STRATEGY: 
   - Opening approach (how to greet and set the tone)
   - Core questions to explore (tailored to this candidate + this role)
   - Specific areas to probe (gaps between resume and job requirements)
   - Follow-up strategies for each topic area
   - Technical depth to target
5. EVALUATION CRITERIA: What you're looking for in responses
6. BEHAVIORAL GUIDELINES:
   - Maintain natural conversation flow
   - Ask one question at a time
   - Listen actively and reference previous answers
   - Be professional but ${input.interviewType === 'behavioral' ? 'warm and encouraging' : 'appropriately rigorous'}
   - Keep track of time and topics covered
   - Wrap up naturally when enough ground has been covered

The systemPrompt should be 300-500 words and read like instructions to an interviewer who has already studied both the job description and the candidate's resume.

IMPORTANT: Respond with ONLY the JSON object. No markdown, no code fences, no explanation before or after. Just the raw JSON.`;
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
