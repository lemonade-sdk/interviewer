import { AgentPersona, InterviewStyle, InterviewType } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { v4 as uuidv4 } from 'uuid';
import { PhasePromptBuilder } from './PhasePromptBuilder';

/**
 * PersonaGeneratorService
 *
 * Analyzes uploaded documents (Job Description + Resume) and auto-generates
 * a tailored interviewer persona using natural language prompts from phase-prompts.json.
 *
 * The generated JSON contains 21 fields including full persona context for phase-based
 * interview prompting.
 */

export interface PersonaGenerationInput {
  jobDescriptionText: string;
  resumeText: string;
  interviewType: InterviewType;
  company: string;
  position: string;
  numberOfQuestions?: number;
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
   * Small local models typically load with 4-16K context. The prompt
   * template itself is ~600 tokens, so we cap each document at ~4000
   * characters (~1000-1200 tokens) to stay safely within a 4K window
   * while still leaving room for the model's output. When the context
   * is larger (16K+), truncation is rarely hit because real JDs/resumes
   * seldom exceed 4K chars.
   */
  private static readonly MAX_DOC_CHARS = 4000;

  private truncate(text: string, maxChars: number = PersonaGeneratorService.MAX_DOC_CHARS): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n[...truncated for length]';
  }

  /**
   * Generate an interviewer persona from job description and resume.
   *
   * Uses natural language prompts from phase-prompts.json for better readability
   * and maintainability compared to UCL format.
   */
  async generatePersona(input: PersonaGenerationInput): Promise<GeneratedPersonaResult> {
    const jd = this.truncate(input.jobDescriptionText);
    const resume = this.truncate(input.resumeText);

    // Use PhasePromptBuilder for natural language persona generation prompts
    const userPrompt = PhasePromptBuilder.getInstance().getPersonaGenerationUserPrompt({
      jobDescription: jd,
      resume,
      interviewType: input.interviewType,
      company: input.company,
      position: input.position,
    });

    const rawResponse = await this.lemonadeClient.sendMessage(
      [
        {
          id: 'persona-gen-system',
          role: 'system',
          content: PhasePromptBuilder.getInstance().getPersonaGenerationSystemPrompt(),
          timestamp: new Date().toISOString(),
        },
        {
          id: 'persona-gen-user',
          role: 'user',
          content: userPrompt,
          timestamp: new Date().toISOString(),
        },
      ],
      { maxTokens: 8192 },
    );

    console.log('[PersonaGeneratorService] Raw response length:', rawResponse.length);
    console.log('[PersonaGeneratorService] Raw response:', rawResponse);

    const parsed = this.parseJSON(rawResponse);

    if (!parsed) {
      console.warn('[PersonaGeneratorService] JSON parse failed — using fallback persona');
      return this.buildFallbackPersona(input);
    }

    const now = new Date().toISOString();

    const validStyles: InterviewStyle[] = ['conversational', 'formal', 'challenging', 'supportive'];
    const rawStyle = String(parsed.interviewStyle ?? '');
    const interviewStyle: InterviewStyle = validStyles.includes(rawStyle as InterviewStyle)
      ? (rawStyle as InterviewStyle)
      : 'conversational';

    const validDifficulties = ['easy', 'medium', 'hard'];
    const rawDifficulty = String(parsed.questionDifficulty ?? '');
    const questionDifficulty: 'easy' | 'medium' | 'hard' = validDifficulties.includes(rawDifficulty)
      ? (rawDifficulty as 'easy' | 'medium' | 'hard')
      : 'medium';

    const personaName = typeof parsed.personaName === 'string' ? parsed.personaName : 'Interviewer';
    const personaRole = typeof parsed.personaRole === 'string' ? parsed.personaRole : `Hiring Manager at ${input.company}`;

    // Extract or build persona full context
    const personaFullContext = typeof parsed.personaFullContext === 'string'
      ? parsed.personaFullContext
      : this.buildPersonaFullContext(personaName, personaRole, interviewStyle, parsed.primaryProbeArea as string);

    // Extract years of experience from personaRole
    const personaExperience = typeof parsed.personaExperience === 'string'
      ? parsed.personaExperience
      : this.extractExperienceYears(personaRole);

    const persona: AgentPersona = {
      id: uuidv4(),
      name: personaName,
      personaRole,
      // description is not in the v8.1 JSON template; derive it from name + role
      description: `${personaName} — ${personaRole}`,
      systemPrompt: '', // No longer injected as prose; persona fields are UCL variables
      interviewStyle,
      questionDifficulty,
      // NEW: Full persona context for phase-based prompting
      personaFullContext,
      personaExperience,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      // Interview arc fields (19-field JSON)
      q1Topic: typeof parsed.q1Topic === 'string' ? parsed.q1Topic : '',
      q2Topic: typeof parsed.q2Topic === 'string' ? parsed.q2Topic : '',
      q3Topic: typeof parsed.q3Topic === 'string' ? parsed.q3Topic : '',
      q4Topic: typeof parsed.q4Topic === 'string' ? parsed.q4Topic : '',
      q5Topic: typeof parsed.q5Topic === 'string' ? parsed.q5Topic : '',
      primaryProbeArea: typeof parsed.primaryProbeArea === 'string' ? parsed.primaryProbeArea : '',
      mustCoverTopic1: typeof parsed.mustCoverTopic1 === 'string' ? parsed.mustCoverTopic1 : '',
      mustCoverTopic2: typeof parsed.mustCoverTopic2 === 'string' ? parsed.mustCoverTopic2 : '',
      mustCoverTopic3: typeof parsed.mustCoverTopic3 === 'string' ? parsed.mustCoverTopic3 : '',
      validateClaim1: typeof parsed.validateClaim1 === 'string' ? parsed.validateClaim1 : '',
      validateClaim2: typeof parsed.validateClaim2 === 'string' ? parsed.validateClaim2 : '',
      watchSignal1: typeof parsed.watchSignal1 === 'string' ? parsed.watchSignal1 : '',
      watchSignal2: typeof parsed.watchSignal2 === 'string' ? parsed.watchSignal2 : '',
      // Voice gender for TTS voice matching (male, female, or neutral)
      gender: parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'neutral' 
        ? parsed.gender 
        : 'neutral',
    };

    return {
      persona,
      jobAnalysis: typeof parsed.jobAnalysis === 'string' ? parsed.jobAnalysis : '',
      resumeAnalysis: typeof parsed.resumeAnalysis === 'string' ? parsed.resumeAnalysis : '',
    };
  }

  /**
   * Parse JSON with multiple fallback strategies.
   */
  private parseJSON(response: string): Record<string, unknown> | null {
    if (!response) return null;

    const cleaned = response.trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // continue
    }

    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        // continue
      }
    }

    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
      } catch {
        // all fallbacks failed
      }
    }

    return null;
  }

  /**
   * Build a fallback persona when JSON generation fails entirely.
   */
  private buildFallbackPersona(input: PersonaGenerationInput): GeneratedPersonaResult {
    const now = new Date().toISOString();
    const personaName = 'Interviewer';
    const personaRole = `Hiring Manager at ${input.company}`;

    const style = input.interviewType === 'behavioral' ? 'supportive' : 'conversational';

    const persona: AgentPersona = {
      id: uuidv4(),
      name: personaName,
      personaRole,
      description: `${personaName} — ${personaRole}`,
      systemPrompt: '',
      interviewStyle: style,
      questionDifficulty: 'medium',
      // Full persona context for phase-based prompting
      personaFullContext: this.buildPersonaFullContext(personaName, personaRole, style),
      personaExperience: 'several years',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      q1Topic: `Tell me about your background and what drew you to the ${input.position} role at ${input.company}.`,
      q2Topic: 'Describe a challenging technical problem you solved recently and the architectural decisions you made.',
      q3Topic: 'Tell me about a time you had to lead or collaborate through a difficult situation. What was your specific contribution?',
      q4Topic: 'Walk me through a key project from your resume in detail — what was your exact role and what were the measurable outcomes?',
      q5Topic: 'What is the most complex technical or domain challenge you have faced, and how did you approach solving it?',
      primaryProbeArea: `Core technical and behavioral competencies for ${input.position}`,
      mustCoverTopic1: `Technical depth relevant to ${input.interviewType} interview`,
      mustCoverTopic2: 'Team collaboration and communication effectiveness',
      mustCoverTopic3: `Motivation and culture alignment with ${input.company}`,
      validateClaim1: 'Technical experience and ownership claims in resume',
      validateClaim2: 'Leadership or project impact claims',
      watchSignal1: 'Level of ownership vs. passive participation in described projects',
      watchSignal2: 'Ability to handle ambiguity and self-direct under pressure',
    };

    return {
      persona,
      jobAnalysis: `Role requires skills relevant to ${input.interviewType} interview for ${input.position} at ${input.company}.`,
      resumeAnalysis: `Candidate profile reviewed for alignment with ${input.position} requirements.`,
    };
  }

  /**
   * Build full persona context from available information
   */
  private buildPersonaFullContext(
    name: string,
    role: string,
    style: string,
    probeArea?: string
  ): string {
    const styleDescriptions: Record<string, string> = {
      'conversational': 'creates a relaxed atmosphere while probing for depth',
      'formal': 'maintains professional structure to thoroughly assess qualifications',
      'challenging': 'pushes candidates to demonstrate depth with rigorous follow-ups',
      'supportive': 'creates comfort while thoroughly evaluating capabilities',
    };

    const styleDesc = styleDescriptions[style] || 'conducts thorough professional interviews';
    const focus = probeArea || 'technical and leadership competencies';

    return `${name} is a ${role}. Known for a ${style} interview style that ${styleDesc}. Focuses on assessing ${focus}.`;
  }

  /**
   * Extract years of experience from personaRole string
   */
  private extractExperienceYears(role: string): string {
    const match = role.match(/(\d+)[\+\s]*years?/i);
    return match ? `${match[1]} years` : 'several years';
  }
}
