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
    return text.replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : `\${${key}}`;
    });
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
  }): string {
    return this.interpolate(prompts.interview.systemPrompt.withPersona as string | string[], variables);
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
  }): string {
    return this.interpolate(prompts.interview.systemPrompt.fallback as string | string[], variables);
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
    resume: string;
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
