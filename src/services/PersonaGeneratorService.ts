import { AgentPersona, InterviewStyle, InterviewType } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { v4 as uuidv4 } from 'uuid';
import { PromptManager } from './PromptManager';
import { PipelineLogger } from './PipelineLogger';

/**
 * PersonaGeneratorService
 *
 * Analyzes uploaded documents (Job Description + Resume) and auto-generates
 * a tailored interviewer persona using a single UCL-driven LLM call that
 * outputs structured JSON directly (no separate extraction stage).
 *
 * The generated JSON contains 19 fields that slot directly into UCL directives
 * in the interview system prompt — persona identity, a 5-question arc,
 * must-cover topics, validation targets, and behavioral watch signals.
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
   * Model is loaded with ctx_size=16384 (~4 chars per token → ~65K chars context).
   * The persona system prompt is ~800 tokens (~3200 chars), leaving ~12K tokens
   * (~48K chars) for the job description. We cap at 8000 chars to be conservative
   * while capturing full real-world JDs (typically 2000-6000 chars).
   */
  private static readonly MAX_DOC_CHARS = 8000;

  private truncate(text: string, maxChars: number = PersonaGeneratorService.MAX_DOC_CHARS): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n[...truncated for length]';
  }

  /**
   * Generate an interviewer persona from job description and resume.
   *
   * Single UCL call: persona.generation.systemPrompt instructs the model to
   * output JSON directly. The resulting JSON is parsed and mapped to AgentPersona.
   */
  async generatePersona(input: PersonaGenerationInput): Promise<GeneratedPersonaResult> {
    const jdOriginalLen = input.jobDescriptionText.length;
    const jd = this.truncate(input.jobDescriptionText);
    const numberOfQuestions = input.numberOfQuestions ?? 5;

    const systemPromptContent = PromptManager.getInstance().getPersonaGenerationSystemPrompt();
    const userPrompt = PromptManager.getInstance().getPersonaGenerationUserPrompt({
      jobDescription: jd,
      interviewType: input.interviewType,
      company: input.company,
      position: input.position,
      numberOfQuestions,
    });

    console.log(`[PersonaGen] ── Persona Generation ────────────────────────────`);
    console.log(`[PersonaGen] Company: "${input.company}", Position: "${input.position}", Type: "${input.interviewType}"`);
    console.log(`[PersonaGen] JD: ${jdOriginalLen} chars total, ${jd.length} chars after cap${jdOriginalLen > jd.length ? ' (TRUNCATED)' : ' (full)'}`);
    console.log(`[PersonaGen] System prompt: ${systemPromptContent.length} chars`);
    console.log(`[PersonaGen] User prompt:   ${userPrompt.length} chars`);
    console.log(`[PersonaGen] Total input chars: ~${systemPromptContent.length + userPrompt.length}`);
    console.log(`[PersonaGen] JD preview (first 300 chars):\n${jd.substring(0, 300)}...`);

    const personaGenStart = Date.now();
    const rawResponse = await this.lemonadeClient.sendMessage(
      [
        {
          id: 'persona-gen-system',
          role: 'system',
          content: systemPromptContent,
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

    const personaGenDurationMs = Date.now() - personaGenStart;

    console.log(`[PersonaGen] Raw response (${rawResponse.length} chars):\n${rawResponse.substring(0, 1000)}`);
    if (rawResponse.length > 1000) console.log(`[PersonaGen] ...response continues (${rawResponse.length - 1000} more chars)`);

    const parsed = this.parseJSON(rawResponse);

    if (!parsed) {
      console.warn('[PersonaGen] JSON parse failed — all 3 strategies exhausted. Using fallback persona.');
      try {
        PipelineLogger.getInstance().log('persona-gen', {
          stage: 'persona-generation',
          model: 'unknown',
          inputChars: systemPromptContent.length + userPrompt.length,
          inputTokensEst: Math.round((systemPromptContent.length + userPrompt.length) / 4),
          maxOutputTokens: 8192,
          messageCount: 2,
          systemChars: systemPromptContent.length,
          userChars: userPrompt.length,
          finishReason: 'parse-failed',
          outputChars: rawResponse.length,
          outputPreview: rawResponse.substring(0, 600),
          extracted: { parsedOk: false },
          meta: { company: input.company, position: input.position, interviewType: input.interviewType },
          durationMs: personaGenDurationMs,
          timestamp: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
      return this.buildFallbackPersona(input);
    }

    console.log(`[PersonaGen] JSON parsed OK. Fields: personaName="${parsed.personaName}", personaRole="${parsed.personaRole}", interviewStyle="${parsed.interviewStyle}", questionDifficulty="${parsed.questionDifficulty}"`);
    console.log(`[PersonaGen] Q-topics: q1="${String(parsed.q1Topic).substring(0, 80)}...", q2="${String(parsed.q2Topic).substring(0, 60)}..."`);
    console.log(`[PersonaGen] Must-cover: 1="${parsed.mustCoverTopic1}", 2="${parsed.mustCoverTopic2}", 3="${parsed.mustCoverTopic3}"`);

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

    const persona: AgentPersona = {
      id: uuidv4(),
      name: personaName,
      personaRole,
      // description is not in the v8.1 JSON template; derive it from name + role
      description: `${personaName} — ${personaRole}`,
      systemPrompt: '', // No longer injected as prose; persona fields are UCL variables
      interviewStyle,
      questionDifficulty,
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

    const result = {
      persona,
      jobAnalysis: typeof parsed.jobAnalysis === 'string' ? parsed.jobAnalysis : '',
      resumeAnalysis: typeof parsed.resumeAnalysis === 'string' ? parsed.resumeAnalysis : '',
    };

    try {
      PipelineLogger.getInstance().log(persona.id, {
        stage: 'persona-generation',
        model: 'unknown',
        inputChars: systemPromptContent.length + userPrompt.length,
        inputTokensEst: Math.round((systemPromptContent.length + userPrompt.length) / 4),
        maxOutputTokens: 8192,
        messageCount: 2,
        systemChars: systemPromptContent.length,
        userChars: userPrompt.length,
        finishReason: 'stop',
        outputChars: rawResponse.length,
        outputPreview: rawResponse.substring(0, 600),
        extracted: {
          parsedOk: true,
          personaName: persona.name,
          personaRole: persona.personaRole ?? null,
          interviewStyle: persona.interviewStyle,
          questionDifficulty: persona.questionDifficulty,
          gender: persona.gender ?? null,
        },
        meta: {
          personaId: persona.id,
          company: input.company,
          position: input.position,
          interviewType: input.interviewType,
          jdChars: jd.length,
          jdOriginalChars: jdOriginalLen,
        },
        durationMs: personaGenDurationMs,
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return result;
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

    const persona: AgentPersona = {
      id: uuidv4(),
      name: personaName,
      personaRole,
      description: `${personaName} — ${personaRole}`,
      systemPrompt: '',
      interviewStyle: input.interviewType === 'behavioral' ? 'supportive' : 'conversational',
      questionDifficulty: 'medium',
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
}
