import * as fs from 'fs';
import * as path from 'path';
import {
  AgentPersona,
  InterviewPhase,
  PhaseConfig,
  PhasePromptsConfig,
  InterviewPhaseState,
  Message,
  TransitionRule,
  EdgeCaseHandler,
  getNextPhase,
  isInterviewPhase,
  isClosingPhase,
  PHASE_NUMBERS,
} from '../types';

/**
 * PhasePromptBuilder
 *
 * Dynamically assembles interview prompts based on the current phase, persona,
 * and conversation context. Supports:
 * - Phase-specific prompt assembly from phase-prompts.json
 * - Variable substitution from persona and context
 * - Edge case addendum injection
 * - Phase recovery from conversation history
 * - Transition detection and rules
 */
export class PhasePromptBuilder {
  private static instance: PhasePromptBuilder;
  private phaseConfig: PhasePromptsConfig | null = null;
  private configPath: string;

  constructor() {
    this.configPath = this.resolveConfigPath();
    this.loadConfig();
  }

  /**
   * Resolve config path for both development and production (Electron)
   */
  private resolveConfigPath(): string {
    console.log('[PhasePromptBuilder] Resolving config...');
    console.log('[PhasePromptBuilder] __dirname:', __dirname);
    console.log('[PhasePromptBuilder] process.cwd():', process.cwd());

    // Try multiple possible locations
    const possiblePaths = [
      // Development: src/services/../data/
      path.join(__dirname, '..', 'data', 'phase-prompts.json'),
      // Electron production: different relative paths
      path.join(__dirname, '..', '..', '..', 'src', 'data', 'phase-prompts.json'),
      path.join(__dirname, '..', '..', 'src', 'data', 'phase-prompts.json'),
      // Absolute from project root (if __dirname is deep in dist)
      path.join(process.cwd(), 'src', 'data', 'phase-prompts.json'),
      path.join(process.cwd(), 'dist', 'electron', 'src', 'data', 'phase-prompts.json'),
      // Electron resources path
      path.join(process.cwd(), '..', '..', 'src', 'data', 'phase-prompts.json'),
      path.join(process.cwd(), '..', 'src', 'data', 'phase-prompts.json'),
    ];

    for (const tryPath of possiblePaths) {
      console.log('[PhasePromptBuilder] Checking path:', tryPath, '- exists:', fs.existsSync(tryPath));
      if (fs.existsSync(tryPath)) {
        console.log('[PhasePromptBuilder] Found config at:', tryPath);
        return tryPath;
      }
    }

    // Return default if none found (will show error in loadConfig)
    console.error('[PhasePromptBuilder] No config file found in any location');
    return possiblePaths[0];
  }

  static getInstance(): PhasePromptBuilder {
    if (!PhasePromptBuilder.instance) {
      PhasePromptBuilder.instance = new PhasePromptBuilder();
    }
    return PhasePromptBuilder.instance;
  }

  /**
   * Load phase prompts configuration from JSON file
   */
  private loadConfig(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.error('[PhasePromptBuilder] Config file not found:', this.configPath);
        return;
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.phaseConfig = JSON.parse(content) as PhasePromptsConfig;
      console.log('[PhasePromptBuilder] Loaded phase prompts config v' + this.phaseConfig._meta.version);
    } catch (error) {
      console.error('[PhasePromptBuilder] Failed to load config:', error);
    }
  }

  /**
   * Reload configuration (useful for hot-reload during development)
   */
  reloadConfig(): void {
    console.log('[PhasePromptBuilder] Reloading configuration...');
    this.loadConfig();
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.phaseConfig !== null;
  }

  /**
   * Build a complete system prompt for the current phase
   *
   * @param phase - Current interview phase
   * @param persona - The interviewer persona
   * @param state - Current phase state
   * @param context - Additional context variables
   * @param edgeCase - Optional edge case handler to inject
   * @returns Assembled system prompt string
   */
  buildSystemPrompt(
    phase: InterviewPhase,
    persona: AgentPersona,
    state: InterviewPhaseState,
    context: PromptContext,
    edgeCase?: string
  ): string {
    if (!this.phaseConfig) {
      console.warn('[PhasePromptBuilder] No config loaded, returning fallback prompt');
      return this.buildFallbackPrompt(persona, context);
    }

    const phaseConfig = this.phaseConfig.phase_prompts[phase];
    if (!phaseConfig) {
      console.error('[PhasePromptBuilder] Unknown phase:', phase);
      return this.buildFallbackPrompt(persona, context);
    }

    // Assemble prompt parts
    const parts: string[] = [];

    // 1. Core identity (always present)
    parts.push(...this.phaseConfig.core_identity.system_prompt);
    parts.push(''); // Empty line separator

    // 2. Phase-specific instructions
    const phasePromptRaw = phaseConfig.system_prompt.join('\n');
    const phasePrompt = this.substituteVariables(
      phasePromptRaw,
      persona,
      context,
      state
    );
    // Debug: Log first 200 chars of phase prompt to verify substitution
    console.log(`[PhasePromptBuilder] Phase ${phase} prompt (first 200 chars): ${phasePrompt.substring(0, 200)}...`);
    console.log(`[PhasePromptBuilder] Persona: ${persona.name}, Role: ${persona.personaRole}, Company: ${context.company}`);
    parts.push(phasePrompt);

    // 3. Edge case addendum (if triggered)
    if (edgeCase) {
      const edgeCasePrompt = this.buildEdgeCaseAddendum(edgeCase, phase);
      if (edgeCasePrompt) {
        parts.push('');
        parts.push('=== EDGE CASE HANDLING ===');
        parts.push(edgeCasePrompt);
      }
    }

    // 4. Time pressure signal (if applicable)
    const timeSignal = this.buildTimePressureSignal(context, phase);
    if (timeSignal) {
      parts.push('');
      parts.push(timeSignal);
    }

    return parts.join('\n');
  }

  /**
   * Build a fallback prompt when phase config is unavailable
   */
  private buildFallbackPrompt(persona: AgentPersona, context: PromptContext): string {
    const lines = [
      `You are ${persona.name}, ${persona.personaRole || 'Hiring Manager'} at ${context.company || 'the company'}.`,
      `You are conducting a job interview for the ${context.position || 'position'} position.`,
      '',
      'ABSOLUTE RULES:',
      '1. NEVER identify yourself as an AI.',
      '2. Maximum 3 sentences per response.',
      '3. Use neutral tone—no evaluative language.',
      '4. Stay in character throughout.',
      '',
      `INTERVIEW STYLE: ${persona.interviewStyle} | DIFFICULTY: ${persona.questionDifficulty}`,
      '',
      `TOTAL DURATION: ${context.totalInterviewMinutes || 30} minutes`,
      `TIME REMAINING: ${context.currentMinutesRemaining || 30} minutes`,
    ];

    return lines.join('\n');
  }

  /**
   * Substitute variables in prompt template
   */
  private substituteVariables(
    template: string,
    persona: AgentPersona,
    context: PromptContext,
    state: InterviewPhaseState
  ): string {
    let result = template;

    // Persona variables
    const substitutions: Record<string, string> = {
      '${personaName}': persona.name,
      '${personaRole}': persona.personaRole || 'Hiring Manager',
      '${personaFullContext}': persona.personaFullContext || this.buildDefaultPersonaContext(persona),
      '${personaExperience}': persona.personaExperience || 'several years',
      '${company}': context.company || 'the company',
      '${position}': context.position || 'this position',
      '${interviewStyle}': persona.interviewStyle,
      '${questionDifficulty}': persona.questionDifficulty,
      '${gender}': persona.gender || 'neutral',

      // Context variables
      '${totalInterviewMinutes}': String(context.totalInterviewMinutes || 30),
      '${currentMinutesRemaining}': String(context.currentMinutesRemaining || 30),
      '${currentPhaseNumber}': String(PHASE_NUMBERS[state.currentPhase]),
      '${currentPhaseKeyword}': state.currentPhase,

      // Phase-specific persona fields
      '${q1Topic}': persona.q1Topic || 'Tell me about your background.',
      '${q2Topic}': persona.q2Topic || 'Describe a technical challenge you solved.',
      '${q3Topic}': persona.q3Topic || 'Tell me about a leadership situation.',
      '${q4Topic}': persona.q4Topic || 'Walk me through a project on your resume.',
      '${q5Topic}': persona.q5Topic || 'What is the most complex problem you have solved?',
      '${primaryProbeArea}': persona.primaryProbeArea || 'Technical depth and problem-solving',
      '${mustCoverTopic1}': persona.mustCoverTopic1 || 'Core technical competencies',
      '${mustCoverTopic2}': persona.mustCoverTopic2 || 'Team collaboration',
      '${mustCoverTopic3}': persona.mustCoverTopic3 || 'Communication effectiveness',
      '${validateClaim1}': persona.validateClaim1 || 'Technical experience claims',
      '${validateClaim2}': persona.validateClaim2 || 'Leadership impact claims',
      '${watchSignal1}': persona.watchSignal1 || 'Communication clarity',
      '${watchSignal2}': persona.watchSignal2 || 'Technical depth',
    };

    for (const [key, value] of Object.entries(substitutions)) {
      result = result.replace(new RegExp(this.escapeRegExp(key), 'g'), value);
    }

    return result;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build default persona context when not provided
   */
  private buildDefaultPersonaContext(persona: AgentPersona): string {
    const styleDescriptions: Record<string, string> = {
      'conversational': 'Known for creating a relaxed, conversational atmosphere while still probing for depth.',
      'formal': 'Maintains a professional, structured approach to thoroughly assess qualifications.',
      'challenging': 'Pushes candidates to demonstrate depth with follow-up questions on architectural decisions and trade-offs.',
      'supportive': 'Creates a comfortable environment while still thoroughly evaluating capabilities.',
    };

    const styleDesc = styleDescriptions[persona.interviewStyle] || 'Conducts thorough, professional interviews.';
    const role = persona.personaRole || 'hiring manager';

    return `${persona.name} is a ${role}. ${styleDesc} Focuses on ${persona.primaryProbeArea || 'technical and leadership competencies'}.`;
  }

  /**
   * Build edge case addendum for prompt
   */
  private buildEdgeCaseAddendum(edgeCaseKey: string, currentPhase: InterviewPhase): string | null {
    if (!this.phaseConfig) return null;

    const handler = this.phaseConfig.edge_cases.handlers[edgeCaseKey];
    if (!handler) {
      console.warn('[PhasePromptBuilder] Unknown edge case:', edgeCaseKey);
      return null;
    }

    let addendum = handler.prompt_addendum || '';

    // Add phase-specific context
    if (handler.recovery_phase && handler.recovery_phase !== currentPhase) {
      addendum += `\nNote: If recovery fails, transition to ${handler.recovery_phase}.`;
    }

    return addendum;
  }

  /**
   * Build time pressure signal if needed
   */
  private buildTimePressureSignal(context: PromptContext, phase: InterviewPhase): string | null {
    const minutesRemaining = context.currentMinutesRemaining || 30;

    // Midpoint signal (15 minutes remaining)
    if (minutesRemaining <= 15 && minutesRemaining > 5 && !context.midpointSignalSent) {
      return `TIME SIGNAL: ${minutesRemaining} minutes remaining. Focus on highest-priority uncovered topics. Do not open new threads.`;
    }

    // Wrap-up signal (5 minutes remaining)
    if (minutesRemaining <= 5 && !isClosingPhase(phase)) {
      return `URGENT TIME SIGNAL: Only ${minutesRemaining} minutes remaining. Wrap up current topic and move to closing.`;
    }

    return null;
  }

  /**
   * Get phase configuration
   */
  getPhaseConfig(phase: InterviewPhase): PhaseConfig | null {
    if (!this.phaseConfig) return null;
    return this.phaseConfig.phase_prompts[phase] || null;
  }

  /**
   * Get transition rule for a specific phase transition
   */
  getTransitionRule(fromPhase: InterviewPhase, toPhase: InterviewPhase): TransitionRule | null {
    if (!this.phaseConfig) return null;

    const ruleKey = Object.keys(this.phaseConfig.transition_rules.rules).find(key => {
      const rule = this.phaseConfig!.transition_rules.rules[key];
      return rule.from === fromPhase && rule.to === toPhase;
    });

    return ruleKey ? this.phaseConfig.transition_rules.rules[ruleKey] : null;
  }

  /**
   * Get transition rule for advancing from current phase
   */
  getAdvancementRule(currentPhase: InterviewPhase): TransitionRule | null {
    if (!this.phaseConfig) return null;

    const nextPhase = getNextPhase(currentPhase);
    if (!nextPhase) return null;

    return this.getTransitionRule(currentPhase, nextPhase);
  }

  /**
   * Get edge case handler
   */
  getEdgeCaseHandler(edgeCaseKey: string): EdgeCaseHandler | null {
    if (!this.phaseConfig) return null;
    return this.phaseConfig.edge_cases.handlers[edgeCaseKey] || null;
  }

  /**
   * Rebuild phase from conversation history
   * Uses pattern matching and optionally LLM classification
   */
  rebuildPhaseFromHistory(
    messages: Message[],
    _useLLM: boolean = false
  ): { phase: InterviewPhase; confidence: 'high' | 'medium' | 'low' } {
    if (!this.phaseConfig || messages.length === 0) {
      return { phase: 'phase_0_audio_check', confidence: 'low' };
    }

    // Get last few messages for analysis
    const recentMessages = messages.slice(-10);
    const transcript = recentMessages
      .filter(m => m.role === 'assistant' || m.role === 'user')
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')
      .toLowerCase();

    // Pattern-based detection
    const analysisRules = this.phaseConfig.phase_recovery.transcript_analysis_rules;

    for (const rule of analysisRules) {
      const patterns = rule.pattern.toLowerCase().split(',').map(p => p.trim());
      const matches = patterns.some(pattern => transcript.includes(pattern));

      if (matches) {
        // Map rule.indicates to actual phase
        const phase = this.mapIndicatorToPhase(rule.indicates);
        if (phase) {
          return { phase, confidence: rule.confidence };
        }
      }
    }

    // Default: if we have messages, assume we're at least past audio check
    if (messages.length >= 2) {
      return { phase: 'phase_3_q1_warmup', confidence: 'low' };
    }

    return { phase: 'phase_0_audio_check', confidence: 'high' };
  }

  /**
   * Map analysis rule indicator to actual phase
   */
  private mapIndicatorToPhase(indicator: string): InterviewPhase | null {
    const mappings: Record<string, InterviewPhase> = {
      'phase_0_or_1': 'phase_1_warm_rapport',
      'phase_2': 'phase_2_session_overview',
      'phase_3': 'phase_3_q1_warmup',
      'phase_4_or_7': 'phase_4_q2_technical',
      'phase_5': 'phase_5_q3_behavioral',
      'phase_6': 'phase_6_q4_validation',
      'phase_8': 'phase_8_candidate_questions',
      'phase_9': 'phase_9_closing',
    };

    return mappings[indicator] || null;
  }

  /**
   * Check if candidate response matches expected patterns for phase
   */
  matchesExpectedResponse(
    candidateResponse: string,
    phase: InterviewPhase,
    patternType: keyof PhaseConfig['response_patterns'] = 'confirmation'
  ): boolean {
    const config = this.getPhaseConfig(phase);
    if (!config) return true; // Default to allowing advance

    const patterns = config.response_patterns[patternType];
    if (!patterns || patterns.length === 0) return true;

    const response = candidateResponse.toLowerCase();
    return patterns.some(pattern => response.includes(pattern.toLowerCase()));
  }

  /**
   * Check for edge case triggers in candidate response
   */
  detectEdgeCase(
    candidateResponse: string,
    phase: InterviewPhase,
    _state: InterviewPhaseState
  ): string | null {
    if (!this.phaseConfig) return null;

    const response = candidateResponse.toLowerCase();
    const handlers = this.phaseConfig.edge_cases.handlers;

    // Check each edge case trigger pattern
    for (const [key, handler] of Object.entries(handlers)) {
      if (!handler.trigger_patterns) continue;

      const matches = handler.trigger_patterns.some(pattern =>
        response.includes(pattern.toLowerCase())
      );

      if (matches) {
        // Additional context checks
        if (key === 'no_response_timeout') {
          // This is triggered by timer, not response
          continue;
        }

        if (key === 'off_topic_question' && isInterviewPhase(phase)) {
          // More likely to be off-topic during interview phases
          return key;
        }

        return key;
      }
    }

    return null;
  }

  /**
   * Get all available phase names
   */
  getAvailablePhases(): InterviewPhase[] {
    if (!this.phaseConfig) return [];
    return Object.keys(this.phaseConfig.phase_prompts) as InterviewPhase[];
  }

  /**
   * Get phase display info for UI
   */
  getPhaseDisplayInfo(phase: InterviewPhase): { name: string; description: string; number: number } {
    const config = this.getPhaseConfig(phase);
    return {
      name: config?.phase_name || phase,
      description: config?.description || '',
      number: PHASE_NUMBERS[phase],
    };
  }

  // ========== Persona Generation Methods (NEW) ==========

  /**
   * Get persona generation system prompt
   */
  getPersonaGenerationSystemPrompt(): string {
    if (!this.phaseConfig) {
      return this.buildFallbackPersonaGenerationSystemPrompt();
    }
    return this.phaseConfig.persona_generation?.system_prompt?.join('\n') ||
      this.buildFallbackPersonaGenerationSystemPrompt();
  }

  /**
   * Get persona generation user prompt with variables substituted
   */
  getPersonaGenerationUserPrompt(variables: {
    jobDescription: string;
    resume: string;
    interviewType: string;
    company: string;
    position: string;
  }): string {
    if (!this.phaseConfig?.persona_generation?.user_prompt) {
      return this.buildFallbackPersonaGenerationUserPrompt(variables);
    }

    const template = this.phaseConfig.persona_generation.user_prompt.join('\n');
    return template
      .replace(/\$\{jobDescription\}/g, variables.jobDescription)
      .replace(/\$\{resume\}/g, variables.resume)
      .replace(/\$\{interviewType\}/g, variables.interviewType)
      .replace(/\$\{company\}/g, variables.company)
      .replace(/\$\{position\}/g, variables.position);
  }

  // ========== Feedback Methods (NEW) ==========

  /**
   * Get comprehensive feedback system prompt
   */
  getFeedbackComprehensiveSystemPrompt(): string {
    if (!this.phaseConfig) {
      return this.buildFallbackFeedbackComprehensivePrompt();
    }
    return this.phaseConfig.feedback?.comprehensive?.system_prompt?.join('\n') ||
      this.buildFallbackFeedbackComprehensivePrompt();
  }

  /**
   * Get feedback grading system prompt
   */
  getFeedbackGradingSystemPrompt(): string {
    if (!this.phaseConfig) {
      return this.buildFallbackFeedbackGradingPrompt();
    }
    return this.phaseConfig.feedback?.grading?.system_prompt?.join('\n') ||
      this.buildFallbackFeedbackGradingPrompt();
  }

  /**
   * Get feedback grading user prompt with variables substituted
   */
  getFeedbackGradingUserPrompt(variables: {
    question: string;
    answer: string;
  }): string {
    if (!this.phaseConfig?.feedback?.grading?.user_prompt) {
      return `Question: ${variables.question}\n\nAnswer: ${variables.answer}`;
    }

    const template = this.phaseConfig.feedback.grading.user_prompt.join('\n');
    return template
      .replace(/\$\{question\}/g, variables.question)
      .replace(/\$\{answer\}/g, variables.answer);
  }

  // ========== Fallback Methods (NEW) ==========

  private buildFallbackPersonaGenerationSystemPrompt(): string {
    return [
      'You are an Interview Intelligence Generator.',
      'Analyze the job description and resume, then create a tailored interviewer persona.',
      '',
      'Output ONLY a valid JSON object with these fields:',
      '- personaName, personaRole, personaFullContext, personaExperience',
      '- gender, interviewStyle, questionDifficulty',
      '- primaryProbeArea, mustCoverTopic1-3, validateClaim1-2, watchSignal1-2',
      '- q1Topic-q5Topic, jobAnalysis, resumeAnalysis',
      '',
      'Begin immediately with { and output only JSON.',
    ].join('\n');
  }

  private buildFallbackPersonaGenerationUserPrompt(variables: {
    jobDescription: string;
    resume: string;
    interviewType: string;
    company: string;
    position: string;
  }): string {
    return [
      `Generate an interviewer persona for ${variables.position} at ${variables.company}.`,
      '',
      'JOB DESCRIPTION:',
      variables.jobDescription,
      '',
      'RESUME:',
      variables.resume,
      '',
      'Output JSON only.',
    ].join('\n');
  }

  private buildFallbackFeedbackComprehensivePrompt(): string {
    return [
      'You are generating post-interview feedback.',
      '',
      'Provide:',
      '- Overall score (0-100)',
      '- 3-5 strengths with specific evidence',
      '- 3-5 areas for improvement with actionable guidance',
      '- Observations on communication and technical depth',
      '',
      'Use encouraging yet honest tone. Be specific, not generic.',
    ].join('\n');
  }

  private buildFallbackFeedbackGradingPrompt(): string {
    return [
      'You are an expert interview evaluator.',
      '',
      'Provide constructive feedback on this Q&A pair:',
      '- Approximate score (0-100) and rating',
      '- Specific strengths',
      '- Actionable improvements',
      '- Key points for an ideal answer',
      '',
      'Use natural, conversational prose.',
    ].join('\n');
  }
}

/**
 * Context for prompt building
 */
export interface PromptContext {
  company?: string;
  position?: string;
  totalInterviewMinutes?: number;
  currentMinutesRemaining?: number;
  midpointSignalSent?: boolean;
  // Add any other context variables as needed
}

/**
 * Factory function for creating prompt builder
 */
export function createPhasePromptBuilder(): PhasePromptBuilder {
  return PhasePromptBuilder.getInstance();
}
