/**
 * Phase Prompt Test Harness
 *
 * Tests the phase-aware prompting system including:
 * - PhasePromptBuilder prompt assembly
 * - Natural conversation flow (multi-turn greeting)
 * - Edge case handling
 * - Transition rules
 * - Variable substitution
 * - Persona generation prompts
 * - Feedback prompts
 *
 * This harness validates the unified prompt architecture where:
 * - phase-prompts.json contains interview, persona, and feedback prompts
 * - extraction-prompts.json contains data extraction prompts
 */

import { PhasePromptBuilder, PromptContext } from '../services/PhasePromptBuilder';
import { ExtractionPromptBuilder } from '../services/ExtractionPromptBuilder';
import { createInitialPhaseState, AgentPersona } from '../types';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export class PhasePromptTestHarness {
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    this.results = [];

    // PhasePromptBuilder tests
    this.test('PhasePromptBuilder Config Loaded', () => {
      const loaded = PhasePromptBuilder.getInstance().isConfigLoaded();
      if (!loaded) {
        PhasePromptBuilder.getInstance().reloadConfig();
      }
      return PhasePromptBuilder.getInstance().isConfigLoaded();
    });

    this.test('ExtractionPromptBuilder Config Loaded', () => {
      const loaded = ExtractionPromptBuilder.getInstance().isConfigLoaded();
      if (!loaded) {
        ExtractionPromptBuilder.getInstance().reloadConfig();
      }
      return ExtractionPromptBuilder.getInstance().isConfigLoaded();
    });

    // Test phase system prompt building
    this.test('Build Phase 0 (Audio Check) Prompt', () => {
      const persona = this.createMockPersona();
      const state = createInitialPhaseState();
      const context: PromptContext = {
        company: 'TestCorp',
        position: 'Software Engineer',
        totalInterviewMinutes: 30,
      };

      const prompt = PhasePromptBuilder.getInstance().buildSystemPrompt('phase_0_audio_check', persona, state, context);

      // Validate key components
      const hasAudioCheck = prompt.includes('audio') || prompt.includes('hear');
      const hasPersona = prompt.includes(persona.name);
      const hasWait = prompt.includes('WAIT') || prompt.includes('wait');

      return hasAudioCheck && hasPersona && hasWait;
    });

    // Test persona generation prompts
    this.test('Persona Generation System Prompt', () => {
      const prompt = PhasePromptBuilder.getInstance().getPersonaGenerationSystemPrompt();
      return prompt.includes('PERSONA GENERATION') && prompt.includes('21 persona fields');
    });

    this.test('Persona Generation User Prompt', () => {
      const variables = {
        jobDescription: 'Test JD',
        resume: 'Test Resume',
        interviewType: 'technical',
        company: 'TestCorp',
        position: 'Engineer',
      };

      const prompt = PhasePromptBuilder.getInstance().getPersonaGenerationUserPrompt(variables);
      return prompt.includes('Test JD') && prompt.includes('TestCorp') && prompt.includes('Engineer');
    });

    // Test feedback prompts
    this.test('Feedback Comprehensive System Prompt', () => {
      const prompt = PhasePromptBuilder.getInstance().getFeedbackComprehensiveSystemPrompt();
      return prompt.includes('COMPREHENSIVE FEEDBACK') && prompt.includes('strengths') && prompt.includes('weaknesses');
    });

    this.test('Feedback Grading System Prompt', () => {
      const prompt = PhasePromptBuilder.getInstance().getFeedbackGradingSystemPrompt();
      return prompt.includes('QUESTION-LEVEL FEEDBACK') && prompt.includes('score');
    });

    this.test('Feedback Grading User Prompt', () => {
      const prompt = PhasePromptBuilder.getInstance().getFeedbackGradingUserPrompt({
        question: 'What is React?',
        answer: 'A UI library',
      });
      return prompt.includes('What is React?') && prompt.includes('A UI library');
    });

    // Test extraction prompts
    this.test('Document Extraction System Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getDocumentExtractionSystemPrompt();
      return prompt.includes('DOCUMENT EXTRACTION');
    });

    this.test('Document Extraction User Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getDocumentExtractionUserPrompt({
        jobText: 'Senior Engineer at Google',
      });
      return prompt.includes('Senior Engineer at Google');
    });

    this.test('Feedback Extraction System Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getFeedbackExtractionSystemPrompt();
      return prompt.includes('FEEDBACK EXTRACTION') && prompt.includes('JSON');
    });

    this.test('Feedback Extraction User Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getFeedbackExtractionUserPrompt({
        feedbackText: 'Great performance on system design',
      });
      return prompt.includes('Great performance');
    });

    this.test('Question Grade Extraction System Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getQuestionGradeExtractionSystemPrompt();
      return prompt.includes('QUESTION GRADE EXTRACTION');
    });

    this.test('Question Grade Extraction User Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getQuestionGradeExtractionUserPrompt({
        question: 'Q1',
        answer: 'A1',
        feedbackText: 'Good answer',
      });
      return prompt.includes('Q1') && prompt.includes('A1');
    });

    this.test('Job Details Extraction System Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getJobDetailsExtractionSystemPrompt();
      return prompt.includes('JOB DETAILS EXTRACTION');
    });

    this.test('Job Details Extraction User Prompt', () => {
      const prompt = ExtractionPromptBuilder.getInstance().getJobDetailsExtractionUserPrompt({
        jobText: 'Job posting',
        analysisText: 'Analysis result',
      });
      return prompt.includes('Job posting') && prompt.includes('Analysis result');
    });

    // Test variable substitution
    this.test('PersonaFullContext Substitution', () => {
      const persona = this.createMockPersona();
      const state = createInitialPhaseState();
      const context: PromptContext = { company: 'TestCorp' };

      const prompt = PhasePromptBuilder.getInstance().buildSystemPrompt('phase_0_audio_check', persona, state, context);

      return prompt.includes('Alex is a Senior Engineer at TechCorp');
    });

    // Test available phases
    this.test('Get Available Phases', () => {
      const phases = PhasePromptBuilder.getInstance().getAvailablePhases();
      return phases.length === 10 && phases.includes('phase_0_audio_check');
    });

    // Test phase display info
    this.test('Phase Display Info', () => {
      const info = PhasePromptBuilder.getInstance().getPhaseDisplayInfo('phase_0_audio_check');
      return info.number === 0 && info.name.includes('Audio Check');
    });

    // Test fallback methods
    this.test('Fallback Prompt Generation', () => {
      // Create a new builder instance that won't find the config
      const builder = new PhasePromptBuilder();
      // Force fallback by directly testing the fallback method
      const persona = this.createMockPersona();
      const state = createInitialPhaseState();
      const context: PromptContext = {};

      const prompt = builder.buildSystemPrompt('phase_0_audio_check', persona, state, context);
      return prompt.length > 0 && prompt.includes('INTERVIEW');
    });

    console.log(`\n=== Phase Prompt Test Results ===`);
    console.log(`Total: ${this.results.length}`);
    console.log(`Passed: ${this.results.filter(r => r.passed).length}`);
    console.log(`Failed: ${this.results.filter(r => !r.passed).length}`);

    return this.results;
  }

  private test(name: string, fn: () => boolean): void {
    try {
      const passed = fn();
      this.results.push({ test: name, passed });
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
    } catch (error) {
      this.results.push({
        test: name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`[FAIL] ${name}: ${error}`);
    }
  }

  private createMockPersona(): AgentPersona {
    return {
      id: 'test-persona',
      name: 'Alex',
      description: 'Test interviewer persona',
      systemPrompt: 'You are Alex, a senior engineer conducting interviews.',
      interviewStyle: 'conversational',
      questionDifficulty: 'medium',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gender: 'neutral',
      personaRole: 'Senior Engineer at TechCorp',
      personaFullContext: 'Alex is a seasoned engineer with deep expertise in system design.',
      personaExperience: '10 years',
      primaryProbeArea: 'System Design',
      mustCoverTopic1: 'Architecture',
      mustCoverTopic2: 'Trade-offs',
      mustCoverTopic3: 'Performance',
      validateClaim1: 'Scalability experience',
      validateClaim2: 'Leadership skills',
      watchSignal1: 'Communication clarity',
      watchSignal2: 'Depth of knowledge',
      q1Topic: 'Background',
      q2Topic: 'Technical deep dive',
      q3Topic: 'Behavioral',
      q4Topic: 'Resume validation',
      q5Topic: 'Expertise demo',
    };
  }
}

// Run tests if executed directly
if (require.main === module) {
  const harness = new PhasePromptTestHarness();
  harness.runAllTests().then(results => {
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log('\n=== Failed Tests ===');
      failed.forEach(f => console.log(`- ${f.test}: ${f.error || 'Assertion failed'}`));
      process.exit(1);
    }
    console.log('\nAll tests passed!');
    process.exit(0);
  });
}

export default PhasePromptTestHarness;
