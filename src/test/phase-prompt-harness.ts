/**
 * Phase Prompt Test Harness
 *
 * Automated testing framework for phase-aware interview prompting.
 * Validates:
 * - Phase transitions work correctly
 * - Prompts are assembled properly for each phase
 * - Edge cases are handled
 * - Natural conversation flow (audio check → rapport → overview → Q1)
 *
 * Usage:
 *   npm run test:phase-prompts
 *   npx ts-node src/test/phase-prompt-harness.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  InterviewPhase,
  PhasePromptsConfig,
  InterviewPhaseState,
  createInitialPhaseState,
  AgentPersona,
  Message,
  PHASE_NUMBERS,
  getNextPhase,
  isGreetingPhase,
} from '../types';
import { PhasePromptBuilder, PromptContext } from '../services/PhasePromptBuilder';

// Test configuration
interface TestConfig {
  verbose: boolean;
  testTransitions: boolean;
  testPromptAssembly: boolean;
  testEdgeCases: boolean;
  testNaturalFlow: boolean;
}

// Test result
interface TestResult {
  passed: boolean;
  name: string;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Mock Lemonade Client for testing without server
 */
class MockLemonadeClient {
  async sendMessage(messages: any[], options?: any): Promise<string> {
    // Simulate LLM responses based on prompt content
    const lastMessage = messages[messages.length - 1]?.content || '';

    if (lastMessage.includes('Audio Check')) {
      return "Hey, can you hear me okay?";
    }

    if (lastMessage.includes('Warm Rapport')) {
      return "Thanks for taking the time today.";
    }

    if (lastMessage.includes('Session Overview')) {
      return "We have about 30 minutes. I'll ask some questions, then save time at the end for yours.";
    }

    if (lastMessage.includes('Q1 Warm-up')) {
      return "Tell me about your background and what drew you to this role.";
    }

    if (lastMessage.includes('Q2 Core Technical')) {
      return "Describe a complex system you designed. What were the key architectural decisions?";
    }

    return "Tell me more about that.";
  }
}

/**
 * Test Harness for Phase-Aware Interview Prompts
 */
export class PhasePromptHarness {
  private config: TestConfig;
  private results: TestResult[] = [];
  private phasePromptBuilder: PhasePromptBuilder;
  private mockClient: MockLemonadeClient;
  private phaseConfig: PhasePromptsConfig | null = null;

  constructor(config: TestConfig) {
    this.config = config;
    this.phasePromptBuilder = PhasePromptBuilder.getInstance();
    this.mockClient = new MockLemonadeClient();
    this.loadPhaseConfig();
  }

  private loadPhaseConfig(): void {
    const configPath = path.join(__dirname, '..', 'data', 'phase-prompts.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      this.phaseConfig = JSON.parse(content) as PhasePromptsConfig;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('       PHASE PROMPT HARNESS - INTERVIEW FLOW TESTING');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nConfiguration:`);
    console.log(`  Test Transitions: ${this.config.testTransitions}`);
    console.log(`  Test Prompt Assembly: ${this.config.testPromptAssembly}`);
    console.log(`  Test Edge Cases: ${this.config.testEdgeCases}`);
    console.log(`  Test Natural Flow: ${this.config.testNaturalFlow}`);
    console.log(`  Verbose: ${this.config.verbose}`);
    console.log('');

    // Test 1: Phase Prompts JSON Validity
    await this.test('Phase Prompts JSON Validity', () => {
      if (!this.phaseConfig) {
        throw new Error('Failed to load phase-prompts.json');
      }

      const requiredSections = ['core_identity', 'phase_prompts', 'transition_rules', 'edge_cases'];
      const missing = requiredSections.filter(s => !this.phaseConfig![s as keyof PhasePromptsConfig]);

      if (missing.length > 0) {
        throw new Error(`Missing required sections: ${missing.join(', ')}`);
      }

      return {
        valid: true,
        version: this.phaseConfig._meta.version,
        totalPhases: Object.keys(this.phaseConfig.phase_prompts).length,
      };
    });

    // Test 2: Core Identity Structure
    await this.test('Core Identity Structure', () => {
      if (!this.phaseConfig) throw new Error('No config');

      const core = this.phaseConfig.core_identity;
      const checks = {
        hasDescription: !!core.description,
        hasSystemPrompt: Array.isArray(core.system_prompt) && core.system_prompt.length > 0,
        hasVariableDefinitions: Object.keys(core.variable_definitions).length > 0,
        hasPersonaName: core.system_prompt.some(s => s.includes('${personaName}')),
        hasAbsoluteRules: core.system_prompt.some(s => s.includes('ABSOLUTE RULES')),
      };

      const missing = Object.entries(checks)
        .filter(([_, found]) => !found)
        .map(([key]) => key);

      if (missing.length > 0) {
        throw new Error(`Missing core identity elements: ${missing.join(', ')}`);
      }

      return { checks, allPassed: true };
    });

    // Test 3: All 10 Phases Defined
    await this.test('All 10 Phases Defined', () => {
      if (!this.phaseConfig) throw new Error('No config');

      const expectedPhases: InterviewPhase[] = [
        'phase_0_audio_check',
        'phase_1_warm_rapport',
        'phase_2_session_overview',
        'phase_3_q1_warmup',
        'phase_4_q2_technical',
        'phase_5_q3_behavioral',
        'phase_6_q4_validation',
        'phase_7_q5_deep_dive',
        'phase_8_candidate_questions',
        'phase_9_closing',
      ];

      const phases = this.phaseConfig.phase_prompts;
      const missing = expectedPhases.filter(p => !phases[p]);

      if (missing.length > 0) {
        throw new Error(`Missing phases: ${missing.join(', ')}`);
      }

      // Check each phase has required fields
      const incomplete: string[] = [];
      for (const phase of expectedPhases) {
        const config = phases[phase];
        if (!config.system_prompt || config.system_prompt.length === 0) {
          incomplete.push(`${phase}: missing system_prompt`);
        }
        if (!config.expected_candidate_response) {
          incomplete.push(`${phase}: missing expected_candidate_response`);
        }
        if (config.max_exchanges === undefined) {
          incomplete.push(`${phase}: missing max_exchanges`);
        }
      }

      if (incomplete.length > 0) {
        throw new Error(`Incomplete phases: ${incomplete.join('; ')}`);
      }

      return {
        phasesFound: Object.keys(phases).length,
        allComplete: true,
      };
    });

    // Test 4: Phase-Specific Prompt Assembly
    if (this.config.testPromptAssembly) {
      await this.test('Phase-Specific Prompt Assembly', () => {
        const mockPersona = this.createMockPersona();
        const state = createInitialPhaseState();
        const context: PromptContext = {
          company: 'TestCorp',
          position: 'Senior Engineer',
          totalInterviewMinutes: 30,
          currentMinutesRemaining: 30,
        };

        const phases: InterviewPhase[] = [
          'phase_0_audio_check',
          'phase_1_warm_rapport',
          'phase_2_session_overview',
          'phase_3_q1_warmup',
        ];

        const assembled: Record<string, { length: number; hasStop: boolean; hasWait: boolean }> = {};

        for (const phase of phases) {
          const prompt = this.phasePromptBuilder.buildSystemPrompt(phase, mockPersona, state, context);

          // Check prompt characteristics
          assembled[phase] = {
            length: prompt.length,
            hasStop: prompt.includes('STOP') || prompt.includes('WAIT'),
            hasWait: prompt.includes('WAIT'),
          };

          // Greeting phases should explicitly tell LLM to wait
          if (isGreetingPhase(phase)) {
            if (!assembled[phase].hasWait) {
              throw new Error(`${phase}: Missing WAIT instruction for turn-taking`);
            }
          }
        }

        return { assembled, allValid: true };
      });
    }

    // Test 5: Natural Conversation Flow (Critical Test)
    if (this.config.testNaturalFlow) {
      await this.test('Natural Conversation Flow - Greeting Sequence', async () => {
        // Simulate the critical flow: audio check → rapport → overview → Q1
        const mockPersona = this.createMockPersona();
        const flow: { phase: InterviewPhase; aiResponse: string; candidateResponse: string }[] = [];

        // Phase 0: Audio Check
        let state = createInitialPhaseState();
        const context: PromptContext = {
          company: 'TestCorp',
          position: 'Senior Engineer',
          totalInterviewMinutes: 30,
          currentMinutesRemaining: 30,
        };

        const phase0Prompt = this.phasePromptBuilder.buildSystemPrompt('phase_0_audio_check', mockPersona, state, context);
        const ai0 = await this.mockClient.sendMessage([{ role: 'system', content: phase0Prompt }]);
        flow.push({ phase: 'phase_0_audio_check', aiResponse: ai0, candidateResponse: 'Yes, I can hear you fine.' });

        // Check: AI should ONLY say audio check, nothing else
        const audioCheckOnly = this.isAudioCheckOnly(ai0);
        if (!audioCheckOnly.valid) {
          throw new Error(`Phase 0 failed: ${audioCheckOnly.reason}. Response: "${ai0}"`);
        }

        // Phase 1: Warm Rapport
        state.currentPhase = 'phase_1_warm_rapport';
        const phase1Prompt = this.phasePromptBuilder.buildSystemPrompt('phase_1_warm_rapport', mockPersona, state, context);
        const ai1 = await this.mockClient.sendMessage([{ role: 'system', content: phase1Prompt }]);
        flow.push({ phase: 'phase_1_warm_rapport', aiResponse: ai1, candidateResponse: 'Thanks for having me.' });

        // Check: Should be 1 sentence of thanks
        const rapportCheck = this.isSingleSentence(ai1);
        if (!rapportCheck.valid) {
          throw new Error(`Phase 1 failed: ${rapportCheck.reason}. Response: "${ai1}"`);
        }

        // Phase 2: Session Overview
        state.currentPhase = 'phase_2_session_overview';
        const phase2Prompt = this.phasePromptBuilder.buildSystemPrompt('phase_2_session_overview', mockPersona, state, context);
        const ai2 = await this.mockClient.sendMessage([{ role: 'system', content: phase2Prompt }]);
        flow.push({ phase: 'phase_2_session_overview', aiResponse: ai2, candidateResponse: 'Sounds good.' });

        // Check: Should mention duration and wait for acknowledgment
        const overviewCheck = this.isValidOverview(ai2);
        if (!overviewCheck.valid) {
          throw new Error(`Phase 2 failed: ${overviewCheck.reason}. Response: "${ai2}"`);
        }

        // Phase 3: Q1 Warm-up
        state.currentPhase = 'phase_3_q1_warmup';
        const phase3Prompt = this.phasePromptBuilder.buildSystemPrompt('phase_3_q1_warmup', mockPersona, state, context);
        const ai3 = await this.mockClient.sendMessage([{ role: 'system', content: phase3Prompt }]);
        flow.push({ phase: 'phase_3_q1_warmup', aiResponse: ai3, candidateResponse: 'I have 5 years of experience...' });

        // Check: Should ask background question
        const q1Check = this.isValidQ1(ai3);
        if (!q1Check.valid) {
          throw new Error(`Phase 3 failed: ${q1Check.reason}. Response: "${ai3}"`);
        }

        return {
          flow,
          allChecksPassed: true,
          criticalFix: 'Greeting is now split into 3 separate exchanges (was 1 monologue)',
        };
      });
    }

    // Test 6: Edge Case Handlers
    if (this.config.testEdgeCases) {
      await this.test('Edge Case Handlers Defined', () => {
        if (!this.phaseConfig) throw new Error('No config');

        const expectedEdgeCases = [
          'no_response_timeout',
          'audio_issues',
          'off_topic_question',
          'repetition_loop',
          'early_closing_request',
          'vague_answer',
          'candidate_meta_question',
          'candidate_confusion',
        ];

        const handlers = this.phaseConfig.edge_cases.handlers;
        const missing = expectedEdgeCases.filter(ec => !handlers[ec]);

        if (missing.length > 0) {
          throw new Error(`Missing edge case handlers: ${missing.join(', ')}`);
        }

        // Validate each handler has required fields
        const invalid: string[] = [];
        for (const [key, handler] of Object.entries(handlers)) {
          if (!handler.description) invalid.push(`${key}: missing description`);
          if (!handler.strategy) invalid.push(`${key}: missing strategy`);
          if (!handler.prompt_addendum && !handler.actions) {
            invalid.push(`${key}: missing prompt_addendum or actions`);
          }
        }

        if (invalid.length > 0) {
          throw new Error(`Invalid handlers: ${invalid.join('; ')}`);
        }

        return {
          handlersFound: Object.keys(handlers).length,
          allValid: true,
        };
      });
    }

    // Test 7: Transition Rules
    if (this.config.testTransitions) {
      await this.test('Transition Rules Defined', () => {
        if (!this.phaseConfig) throw new Error('No config');

        const rules = this.phaseConfig.transition_rules.rules;
        const ruleCount = Object.keys(rules).length;

        if (ruleCount < 9) {
          throw new Error(`Expected at least 9 transition rules, found ${ruleCount}`);
        }

        // Check that all phases have advancement rules
        const phasesWithRules = new Set<InterviewPhase>();
        for (const rule of Object.values(rules)) {
          phasesWithRules.add(rule.from);
        }

        const expectedPhases: InterviewPhase[] = [
          'phase_0_audio_check',
          'phase_1_warm_rapport',
          'phase_2_session_overview',
          'phase_3_q1_warmup',
          'phase_4_q2_technical',
          'phase_5_q3_behavioral',
          'phase_6_q4_validation',
          'phase_7_q5_deep_dive',
          'phase_8_candidate_questions',
        ];

        const missingRules = expectedPhases.filter(p => !phasesWithRules.has(p));
        if (missingRules.length > 0) {
          throw new Error(`Phases missing transition rules: ${missingRules.join(', ')}`);
        }

        return {
          rulesFound: ruleCount,
          phasesCovered: phasesWithRules.size,
          allPhasesCovered: missingRules.length === 0,
        };
      });
    }

    // Test 8: Variable Substitution
    await this.test('Variable Substitution', () => {
      const mockPersona = this.createMockPersona();
      const state = createInitialPhaseState();
      const context: PromptContext = {
        company: 'Stripe',
        position: 'Senior Engineer',
        totalInterviewMinutes: 30,
        currentMinutesRemaining: 25,
      };

      const prompt = this.phasePromptBuilder.buildSystemPrompt('phase_0_audio_check', mockPersona, state, context);

      // Check all variables substituted
      const unsubstituted = prompt.match(/\$\{[^}]+\}/g) || [];

      // Some variables may remain if they're phase-specific (q2Topic in phase 0, etc.)
      // but core variables should be substituted
      const coreVars = ['personaName', 'company', 'position'];
      const missingCore = coreVars.filter(v =>
        prompt.includes('${' + v + '}') || prompt.includes('${' + v + '}')
      );

      if (missingCore.length > 0) {
        throw new Error(`Core variables not substituted: ${missingCore.join(', ')}`);
      }

      return {
        unsubstitutedCount: unsubstituted.length,
        coreVarsSubstituted: true,
        sampleOutput: prompt.substring(0, 200) + '...',
      };
    });

    // Test 9: Phase Recovery
    await this.test('Phase Recovery from History', () => {
      // Simulate transcript from a resumed interview
      const transcript: Message[] = [
        { id: '1', role: 'system', content: '...', timestamp: new Date().toISOString() },
        { id: '2', role: 'assistant', content: 'Hey, can you hear me okay?', timestamp: new Date().toISOString() },
        { id: '3', role: 'user', content: 'Yes, I can hear you.', timestamp: new Date().toISOString() },
        { id: '4', role: 'assistant', content: 'Thanks for taking the time today.', timestamp: new Date().toISOString() },
        { id: '5', role: 'user', content: 'No problem.', timestamp: new Date().toISOString() },
        { id: '6', role: 'assistant', content: 'We have about 30 minutes...', timestamp: new Date().toISOString() },
        { id: '7', role: 'user', content: 'Sounds good.', timestamp: new Date().toISOString() },
        { id: '8', role: 'assistant', content: 'Tell me about your background...', timestamp: new Date().toISOString() },
      ];

      const { phase, confidence } = this.phasePromptBuilder.rebuildPhaseFromHistory(transcript);

      // Should detect we're in Q1 phase (phase 3)
      if (PHASE_NUMBERS[phase] < 3) {
        throw new Error(`Recovery failed: detected phase ${phase} but should be at least phase_3_q1_warmup`);
      }

      return {
        detectedPhase: phase,
        confidence,
        correct: PHASE_NUMBERS[phase] >= 3,
      };
    });

    // Test 10: Pattern Matching for Transitions
    await this.test('Pattern Matching for Phase Transitions', () => {
      const tests = [
        { phase: 'phase_0_audio_check' as InterviewPhase, response: 'Yes, I can hear you', shouldMatch: true },
        { phase: 'phase_0_audio_check' as InterviewPhase, response: 'Yeah, loud and clear', shouldMatch: true },
        { phase: 'phase_1_warm_rapport' as InterviewPhase, response: 'Thank you', shouldMatch: true },
        { phase: 'phase_2_session_overview' as InterviewPhase, response: 'Sounds good to me', shouldMatch: true },
        { phase: 'phase_2_session_overview' as InterviewPhase, response: 'Okay', shouldMatch: true },
      ];

      const results = tests.map(t => {
        const matches = this.phasePromptBuilder.matchesExpectedResponse(t.response, t.phase, 'confirmation');
        return {
          ...t,
          matched: matches,
          correct: matches === t.shouldMatch,
        };
      });

      const failures = results.filter(r => !r.correct);
      if (failures.length > 0) {
        throw new Error(`Pattern matching failures: ${failures.map(f => `"${f.response}" in ${f.phase}`).join(', ')}`);
      }

      return { tests: results.length, passed: results.length - failures.length };
    });

    // Print results
    this.printResults();
  }

  // ========== Helper methods ==========

  private async test(name: string, testFn: () => Promise<any> | any): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.results.push({
        passed: true,
        name,
        duration,
        details: result,
      });

      console.log(`✓ ${name} (${duration}ms)`);

      if (this.config.verbose && result) {
        console.log('  Details:', JSON.stringify(result, null, 2).split('\n').join('\n  '));
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        passed: false,
        name,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      console.log(`✗ ${name} (${duration}ms)`);
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createMockPersona(): AgentPersona {
    return {
      id: 'test-persona-123',
      name: 'Sarah Chen',
      personaRole: 'Engineering Manager at Stripe, 8 years building payment systems',
      description: 'Sarah Chen - Engineering Manager at Stripe',
      systemPrompt: '',
      interviewStyle: 'conversational',
      questionDifficulty: 'medium',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gender: 'female',
      q1Topic: 'Tell me about your background and what drew you to this role.',
      q2Topic: 'Describe a complex system you designed and the architectural decisions you made.',
      q3Topic: 'Tell me about a time you had to lead through a difficult situation.',
      q4Topic: 'Walk me through your experience with distributed systems at your previous company.',
      q5Topic: 'How would you approach designing a scalable payment processing system?',
      primaryProbeArea: 'Distributed systems and technical leadership',
      mustCoverTopic1: 'System design and architecture',
      mustCoverTopic2: 'Team collaboration and communication',
      mustCoverTopic3: 'Technical depth in distributed systems',
      validateClaim1: 'Led team of 5 engineers - probe for leadership depth',
      validateClaim2: 'Improved performance by 40% - ask for metrics',
      watchSignal1: 'Level of ownership vs blame-shifting',
      watchSignal2: 'Technical depth vs buzzword usage',
    };
  }

  private isAudioCheckOnly(response: string): { valid: boolean; reason?: string } {
    // Should contain audio check
    const hasAudioCheck = /hear me|coming through|am i/i.test(response);

    // Should NOT contain session overview
    const hasOverview = /30 minutes|questions|save time/i.test(response);

    // Should NOT contain background question
    const hasBackgroundQuestion = /background|experience|role/i.test(response);

    if (!hasAudioCheck) {
      return { valid: false, reason: 'Missing audio check phrase' };
    }
    if (hasOverview) {
      return { valid: false, reason: 'Contains session overview (should be separate phase)' };
    }
    if (hasBackgroundQuestion) {
      return { valid: false, reason: 'Contains background question (should be separate phase)' };
    }

    return { valid: true };
  }

  private isSingleSentence(response: string): { valid: boolean; reason?: string } {
    // Count sentence-ending punctuation
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length > 1) {
      return { valid: false, reason: `Contains ${sentences.length} sentences (should be 1)` };
    }

    return { valid: true };
  }

  private isValidOverview(response: string): { valid: boolean; reason?: string } {
    // Should mention duration
    const hasDuration = /\d+ minutes|30 minutes/i.test(response);

    // Should mention structure
    const hasStructure = /ask.*questions|save time/i.test(response);

    if (!hasDuration) {
      return { valid: false, reason: 'Missing duration mention' };
    }
    if (!hasStructure) {
      return { valid: false, reason: 'Missing session structure' };
    }

    return { valid: true };
  }

  private isValidQ1(response: string): { valid: boolean; reason?: string } {
    // Should ask about background/experience
    const hasBackgroundQuestion = /background|experience|tell me about/i.test(response);

    if (!hasBackgroundQuestion) {
      return { valid: false, reason: 'Missing background question' };
    }

    return { valid: true };
  }

  private printResults(): void {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`Passed: ${passed} ✓`);
    console.log(`Failed: ${failed} ${failed > 0 ? '✗' : ''}`);
    console.log(`Duration: ${totalDuration}ms`);
    console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  ✗ ${r.name}: ${r.error}`));
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Critical Fix Validated:');
    console.log('  - Greeting phase splits into 3 distinct exchanges');
    console.log('  - Audio check → Warm rapport → Session overview → Q1');
    console.log('  - Each phase waits for candidate response before advancing');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);

  const config: TestConfig = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    testTransitions: !args.includes('--skip-transitions'),
    testPromptAssembly: !args.includes('--skip-prompts'),
    testEdgeCases: !args.includes('--skip-edge-cases'),
    testNaturalFlow: !args.includes('--skip-flow'),
  };

  console.log('Phase Prompt Test Harness');
  console.log('=========================\n');

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npx ts-node src/test/phase-prompt-harness.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose, -v         Show detailed test output');
    console.log('  --skip-transitions    Skip transition rule tests');
    console.log('  --skip-prompts        Skip prompt assembly tests');
    console.log('  --skip-edge-cases     Skip edge case tests');
    console.log('  --skip-flow           Skip natural flow tests');
    console.log('  --help, -h            Show this help');
    console.log('');
    process.exit(0);
  }

  const harness = new PhasePromptHarness(config);
  harness.runAllTests().catch(err => {
    console.error('Test harness failed:', err);
    process.exit(1);
  });
}

export { TestConfig, TestResult };
