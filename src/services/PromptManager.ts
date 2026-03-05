import promptsRaw from '../data/prompts.json';

type PromptVariables = Record<string, string | number | boolean>;

// Type the grading field explicitly since it changed to an object structure
interface GradingPrompt {
  systemPrompt: string[];
  userPrompt: string[];
}

const prompts = promptsRaw as typeof promptsRaw & {
  interview: {
    feedback: {
      grading: GradingPrompt;
    };
  };
};

export class PromptManager {
  private static instance: PromptManager;

  private constructor() {}

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  private interpolate(template: string | string[], variables: PromptVariables): string {
    const text = Array.isArray(template) ? template.join('\n') : template;
    const unresolved: string[] = [];
    const result = text.replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = variables[key];
      if (value !== undefined) return String(value);
      unresolved.push(key);
      return `\${${key}}`;
    });
    if (unresolved.length > 0) {
      console.warn(`[PromptManager] UNRESOLVED template variables: ${unresolved.join(', ')} — these will appear literally in the prompt!`);
    }
    return result;
  }

  getInterviewSystemPromptWithPersona(variables: {
    personaName: string;
    personaRole: string;
    interviewType: string;
    position: string;
    company: string;
    interviewStyle: string;
    questionDifficulty: string;
    numberOfQuestions: number;
    wrapUpThresholdMinutes: number;
    currentMinutesRemaining: number;
    currentPhaseKeyword: string;
    currentTopicInstruction: string;
    q1Topic: string;
    q2Topic: string;
    q3Topic: string;
    q4Topic: string;
    q5Topic: string;
    primaryProbeArea: string;
    mustCoverTopic1: string;
    mustCoverTopic2: string;
    mustCoverTopic3: string;
    validateClaim1: string;
    validateClaim2: string;
    watchSignal1: string;
    watchSignal2: string;
    // v2: Time allocation for coherent UX
    greetingAllocationMinutes?: number;
    timePerQuestionMinutes?: number;
    effectiveInterviewMinutes?: number;
  }): string {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fa1453ff-fde7-4d69-814f-b50075068d86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1fd611'},body:JSON.stringify({sessionId:'1fd611',location:'PromptManager.ts:getInterviewSystemPromptWithPersona',message:'Building withPersona prompt',data:{currentMinutesRemaining:variables.currentMinutesRemaining,totalDurationBeingInjected:variables.currentMinutesRemaining},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // Bridge: the template uses both ${totalInterviewMinutes} (in the UCL SET directive)
    // and ${total_duration} (referenced later). Both map to the session duration at start.
    const enriched = {
      ...variables,
      totalInterviewMinutes: variables.currentMinutesRemaining,
      total_duration: variables.currentMinutesRemaining,
    };
    return this.interpolate(prompts.interview.systemPrompt.withPersona as string | string[], enriched);
  }

  getInterviewSystemPromptFallback(variables: {
    interviewType: string;
    position: string;
    company: string;
    interviewStyle: string;
    questionDifficulty: string;
    numberOfQuestions: number;
    wrapUpThresholdMinutes: number;
    currentMinutesRemaining: number;
    currentPhaseKeyword: string;
    jobDescription: string;
    resume: string;
    // v2: Time allocation for coherent UX
    greetingAllocationMinutes?: number;
    timePerQuestionMinutes?: number;
    effectiveInterviewMinutes?: number;
  }): string {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fa1453ff-fde7-4d69-814f-b50075068d86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1fd611'},body:JSON.stringify({sessionId:'1fd611',location:'PromptManager.ts:getInterviewSystemPromptFallback',message:'Building fallback prompt',data:{currentMinutesRemaining:variables.currentMinutesRemaining,totalDurationBeingInjected:variables.currentMinutesRemaining},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // Bridge: same aliases needed for fallback template
    const enriched = {
      ...variables,
      totalInterviewMinutes: variables.currentMinutesRemaining,
      total_duration: variables.currentMinutesRemaining,
    };
    return this.interpolate(prompts.interview.systemPrompt.fallback as string | string[], enriched);
  }

  getFeedbackComprehensivePrompt(): string {
    const p = prompts.interview.feedback.comprehensive as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getFeedbackGradingSystemPrompt(): string {
    return prompts.interview.feedback.grading.systemPrompt.join('\n');
  }

  getFeedbackGradingUserPrompt(variables: {
    question: string;
    answer: string;
  }): string {
    return this.interpolate(prompts.interview.feedback.grading.userPrompt, variables);
  }

  getPersonaGenerationUserPrompt(variables: {
    jobDescription: string;
    interviewType: string;
    company: string;
    position: string;
    numberOfQuestions: number;
    styleInstruction?: string;
  }): string {
    return this.interpolate(prompts.persona.generation.userPrompt as string | string[], variables);
  }

  getPersonaGenerationSystemPrompt(): string {
    const p = prompts.persona.generation.systemPrompt as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getPersonaGenerationFallbackPrompt(variables: {
    interviewType: string;
    position: string;
    company: string;
    jobDescription: string;
    resume: string;
    toneInstruction: string;
    currentPhaseKeyword: string;
    currentMinutesRemaining: number;
  }): string {
    return this.interpolate(prompts.persona.generation.fallback as string | string[], variables);
  }

  getDocumentExtractionUserPrompt(variables: {
    jobText: string;
  }): string {
    return this.interpolate(prompts.document.extraction.userPrompt as string | string[], variables);
  }

  getDocumentExtractionSystemPrompt(): string {
    const p = prompts.document.extraction.systemPrompt as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  // === Extraction Prompt Methods (Stage 2) ===

  getFeedbackExtractionSystemPrompt(): string {
    const p = prompts.extraction.feedback.systemPrompt as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getFeedbackExtractionUserPrompt(variables: {
    feedbackText: string;
  }): string {
    return this.interpolate(prompts.extraction.feedback.userPrompt as string | string[], variables);
  }

  getQuestionGradeExtractionSystemPrompt(): string {
    const p = prompts.extraction.questionGrade.systemPrompt as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getQuestionGradeExtractionUserPrompt(variables: {
    question: string;
    answer: string;
    feedbackText: string;
  }): string {
    return this.interpolate(prompts.extraction.questionGrade.userPrompt as string | string[], variables);
  }

  getJobDetailsExtractionSystemPrompt(): string {
    const p = prompts.extraction.jobDetails.systemPrompt as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getJobDetailsExtractionUserPrompt(variables: {
    jobText: string;
    analysisText: string;
  }): string {
    return this.interpolate(prompts.extraction.jobDetails.userPrompt as string | string[], variables);
  }
}
