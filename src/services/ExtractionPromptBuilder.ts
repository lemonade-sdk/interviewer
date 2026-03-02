import * as fs from 'fs';
import * as path from 'path';

/**
 * Extraction configuration structure
 */
interface ExtractionConfig {
  _meta: {
    version: string;
    description: string;
    total_sections: number;
    purpose: string;
    migration_source: string;
  };
  document: {
    extraction: {
      description: string;
      system_prompt: string[];
      user_prompt: string[];
      output_format: string;
      extracted_fields: string[];
    };
  };
  feedback: {
    extraction: {
      description: string;
      system_prompt: string[];
      user_prompt: string[];
      output_format: string;
      output_schema: Record<string, string>;
    };
  };
  questionGrade: {
    extraction: {
      description: string;
      system_prompt: string[];
      user_prompt: string[];
      output_format: string;
      output_schema: Record<string, string>;
    };
  };
  jobDetails: {
    extraction: {
      description: string;
      system_prompt: string[];
      user_prompt: string[];
      output_format: string;
      output_schema: Record<string, string>;
    };
  };
}

/**
 * ExtractionPromptBuilder
 *
 * Builds prompts for data extraction tasks:
 * - Document extraction (job postings)
 * - Feedback extraction (parse feedback to JSON)
 * - Question grade extraction (parse grades to JSON)
 * - Job details extraction (parse job analysis to JSON)
 *
 * Replaces PromptManager methods for extraction tasks.
 */
export class ExtractionPromptBuilder {
  private static instance: ExtractionPromptBuilder;
  private extractionConfig: ExtractionConfig | null = null;
  private configPath: string;

  constructor() {
    this.configPath = this.resolveConfigPath();
    this.loadConfig();
  }

  /**
   * Resolve config path for both development and production (Electron)
   */
  private resolveConfigPath(): string {
    console.log('[ExtractionPromptBuilder] Resolving config...');
    console.log('[ExtractionPromptBuilder] __dirname:', __dirname);
    console.log('[ExtractionPromptBuilder] process.cwd():', process.cwd());

    // Try multiple possible locations
    const possiblePaths = [
      // Development: src/services/../data/
      path.join(__dirname, '..', 'data', 'extraction-prompts.json'),
      // Electron production: different relative paths
      path.join(__dirname, '..', '..', '..', 'src', 'data', 'extraction-prompts.json'),
      path.join(__dirname, '..', '..', 'src', 'data', 'extraction-prompts.json'),
      // Absolute from project root (if __dirname is deep in dist)
      path.join(process.cwd(), 'src', 'data', 'extraction-prompts.json'),
      path.join(process.cwd(), 'dist', 'electron', 'src', 'data', 'extraction-prompts.json'),
      // Electron resources path
      path.join(process.cwd(), '..', '..', 'src', 'data', 'extraction-prompts.json'),
      path.join(process.cwd(), '..', 'src', 'data', 'extraction-prompts.json'),
    ];

    for (const tryPath of possiblePaths) {
      console.log('[ExtractionPromptBuilder] Checking path:', tryPath, '- exists:', fs.existsSync(tryPath));
      if (fs.existsSync(tryPath)) {
        console.log('[ExtractionPromptBuilder] Found config at:', tryPath);
        return tryPath;
      }
    }

    // Return default if none found (will show error in loadConfig)
    console.error('[ExtractionPromptBuilder] No config file found in any location');
    return possiblePaths[0];
  }

  static getInstance(): ExtractionPromptBuilder {
    if (!ExtractionPromptBuilder.instance) {
      ExtractionPromptBuilder.instance = new ExtractionPromptBuilder();
    }
    return ExtractionPromptBuilder.instance;
  }

  /**
   * Load extraction prompts configuration from JSON file
   */
  private loadConfig(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.error('[ExtractionPromptBuilder] Config file not found:', this.configPath);
        return;
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.extractionConfig = JSON.parse(content) as ExtractionConfig;
      console.log('[ExtractionPromptBuilder] Loaded extraction prompts config v' + this.extractionConfig._meta.version);
    } catch (error) {
      console.error('[ExtractionPromptBuilder] Failed to load config:', error);
    }
  }

  /**
   * Reload configuration (useful for hot-reload during development)
   */
  reloadConfig(): void {
    console.log('[ExtractionPromptBuilder] Reloading configuration...');
    this.loadConfig();
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.extractionConfig !== null;
  }

  // ========== Document Extraction ==========

  /**
   * Get document extraction system prompt
   */
  getDocumentExtractionSystemPrompt(): string {
    if (!this.extractionConfig) {
      return this.buildFallbackDocumentSystemPrompt();
    }
    return this.extractionConfig.document.extraction.system_prompt.join('\n');
  }

  /**
   * Get document extraction user prompt with variables substituted
   */
  getDocumentExtractionUserPrompt(variables: { jobText: string; fileName?: string }): string {
    if (!this.extractionConfig) {
      return `Extract from this job posting:\n\n${variables.jobText}`;
    }

    let template = this.extractionConfig.document.extraction.user_prompt.join('\n');
    template = template.replace(/\$\{jobText\}/g, variables.jobText);

    // Add filename hint if available
    if (variables.fileName) {
      template += `\n\nDOCUMENT FILENAME (may contain company name): ${variables.fileName}`;
    }

    return template;
  }

  // ========== Feedback Extraction ==========

  /**
   * Get feedback extraction system prompt
   */
  getFeedbackExtractionSystemPrompt(): string {
    if (!this.extractionConfig) {
      return this.buildFallbackFeedbackSystemPrompt();
    }
    return this.extractionConfig.feedback.extraction.system_prompt.join('\n');
  }

  /**
   * Get feedback extraction user prompt with variables substituted
   */
  getFeedbackExtractionUserPrompt(variables: { feedbackText: string }): string {
    if (!this.extractionConfig) {
      return `Extract data from this feedback:\n\n${variables.feedbackText}\n\nOutput JSON only.`;
    }

    const template = this.extractionConfig.feedback.extraction.user_prompt.join('\n');
    return template.replace(/\$\{feedbackText\}/g, variables.feedbackText);
  }

  // ========== Question Grade Extraction ==========

  /**
   * Get question grade extraction system prompt
   */
  getQuestionGradeExtractionSystemPrompt(): string {
    if (!this.extractionConfig) {
      return this.buildFallbackGradeSystemPrompt();
    }
    return this.extractionConfig.questionGrade.extraction.system_prompt.join('\n');
  }

  /**
   * Get question grade extraction user prompt with variables substituted
   */
  getQuestionGradeExtractionUserPrompt(variables: {
    question: string;
    answer: string;
    feedbackText: string;
  }): string {
    if (!this.extractionConfig) {
      return `Question: ${variables.question}\nAnswer: ${variables.answer}\nFeedback: ${variables.feedbackText}\n\nOutput JSON only.`;
    }

    const template = this.extractionConfig.questionGrade.extraction.user_prompt.join('\n');
    return template
      .replace(/\$\{question\}/g, variables.question)
      .replace(/\$\{answer\}/g, variables.answer)
      .replace(/\$\{feedbackText\}/g, variables.feedbackText);
  }

  // ========== Job Details Extraction ==========

  /**
   * Get job details extraction system prompt
   */
  getJobDetailsExtractionSystemPrompt(): string {
    if (!this.extractionConfig) {
      return this.buildFallbackJobDetailsSystemPrompt();
    }
    return this.extractionConfig.jobDetails.extraction.system_prompt.join('\n');
  }

  /**
   * Get job details extraction user prompt with variables substituted
   */
  getJobDetailsExtractionUserPrompt(variables: {
    jobText: string;
    analysisText: string;
  }): string {
    if (!this.extractionConfig) {
      return `Job: ${variables.jobText}\nAnalysis: ${variables.analysisText}\n\nOutput JSON only.`;
    }

    const template = this.extractionConfig.jobDetails.extraction.user_prompt.join('\n');
    return template
      .replace(/\$\{jobText\}/g, variables.jobText)
      .replace(/\$\{analysisText\}/g, variables.analysisText);
  }

  // ========== Fallback Methods ==========

  private buildFallbackDocumentSystemPrompt(): string {
    return [
      'You are a document analyzer. Extract the following from the job posting:',
      '1. Interview Title',
      '2. Company Name',
      '3. Position Title',
      '4. Interview Type (general, technical, behavioral, system-design, coding, or mixed)',
      '',
      'Rules: Extract exactly what is stated. Be direct and specific.',
    ].join('\n');
  }

  private buildFallbackFeedbackSystemPrompt(): string {
    return [
      'You are a data extraction specialist. Output ONLY valid JSON.',
      '',
      'Extract these fields from feedback text:',
      '- overallScore: integer 0-100 or null',
      '- strengths: array of strings',
      '- weaknesses: array of strings',
      '- suggestions: array of strings',
      '',
      'Begin immediately with { and output only JSON.',
    ].join('\n');
  }

  private buildFallbackGradeSystemPrompt(): string {
    return [
      'You are a data extraction specialist for interview grading. Output ONLY valid JSON.',
      '',
      'Extract these fields:',
      '- score: integer 0-100',
      '- rating: one of: excellent, good, needs-improvement',
      '- strengths: array of strings',
      '- improvements: array of strings',
      '- suggestedAnswer: 2-3 sentence string',
      '',
      'Begin immediately with { and output only JSON.',
    ].join('\n');
  }

  private buildFallbackJobDetailsSystemPrompt(): string {
    return [
      'You are a data extraction specialist. Output ONLY valid JSON.',
      '',
      'Extract these fields:',
      '- title: string',
      '- company: string',
      '- position: string',
      '- interviewType: one of: general, technical, behavioral, system-design, coding, mixed',
      '',
      'Begin immediately with { and output only JSON.',
    ].join('\n');
  }
}

/**
 * Factory function for creating extraction prompt builder
 */
export function createExtractionPromptBuilder(): ExtractionPromptBuilder {
  return ExtractionPromptBuilder.getInstance();
}
