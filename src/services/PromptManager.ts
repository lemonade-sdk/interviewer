import prompts from '../data/prompts.json';

type PromptVariables = Record<string, string | number | boolean>;

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
    personaSystemPrompt: string;
    interviewType: string;
    position: string;
    company: string;
    interviewStyle: string;
    questionDifficulty: string;
    numberOfQuestions: number;
    followUpInstruction: string;
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
    followUpInstruction: string;
    styleAdjective: string;
    typeSpecificInstruction: string;
  }): string {
    return this.interpolate(prompts.interview.systemPrompt.fallback as string | string[], variables);
  }

  getFeedbackComprehensivePrompt(): string {
    const p = prompts.interview.feedback.comprehensive as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getFeedbackGradingPrompt(variables: {
    question: string;
    answer: string;
  }): string {
    return this.interpolate(prompts.interview.feedback.grading as string | string[], variables);
  }

  getPersonaGenerationUserPrompt(variables: {
    jobDescription: string;
    resume: string;
    interviewType: string;
    company: string;
    position: string;
    styleInstruction: string;
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

  getPersonaExtractionSystemPrompt(): string {
    const p = prompts.extraction.persona.systemPrompt as string | string[];
    return Array.isArray(p) ? p.join('\n') : p;
  }

  getPersonaExtractionUserPrompt(variables: {
    personaText: string;
  }): string {
    return this.interpolate(prompts.extraction.persona.userPrompt as string | string[], variables);
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
