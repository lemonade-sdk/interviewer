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

  private interpolate(template: string, variables: PromptVariables): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => {
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
    return this.interpolate(prompts.interview.systemPrompt.withPersona, variables);
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
    return this.interpolate(prompts.interview.systemPrompt.fallback, variables);
  }

  getFeedbackComprehensivePrompt(): string {
    return prompts.interview.feedback.comprehensive;
  }

  getFeedbackGradingPrompt(variables: {
    question: string;
    answer: string;
  }): string {
    return this.interpolate(prompts.interview.feedback.grading, variables);
  }

  getPersonaGenerationUserPrompt(variables: {
    jobDescription: string;
    resume: string;
    interviewType: string;
    company: string;
    position: string;
    styleInstruction: string;
  }): string {
    return this.interpolate(prompts.persona.generation.userPrompt, variables);
  }

  getPersonaGenerationSystemPrompt(): string {
    return prompts.persona.generation.systemPrompt;
  }

  getPersonaGenerationFallbackPrompt(variables: {
    interviewType: string;
    position: string;
    company: string;
    jobDescription: string;
    resume: string;
    toneInstruction: string;
  }): string {
    return this.interpolate(prompts.persona.generation.fallback, variables);
  }

  getDocumentExtractionUserPrompt(variables: {
    jobText: string;
  }): string {
    return this.interpolate(prompts.document.extraction.userPrompt, variables);
  }

  getDocumentExtractionSystemPrompt(): string {
    return prompts.document.extraction.systemPrompt;
  }
}
