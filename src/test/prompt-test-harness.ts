/**
 * Prompt Test Harness
 * 
 * Standalone testing framework for interview prompts and persona generation.
 * Tests conversational flow, persona generation, and prompt behavior WITHOUT
 * needing the full Electron app running.
 * 
 * Usage:
 *   npm run test:prompts
 *   npx ts-node src/test/prompt-test-harness.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { LemonadeClient } from '../services/LemonadeClient';
import { PromptManager } from '../services/PromptManager';
import { PersonaGeneratorService } from '../services/PersonaGeneratorService';
import { AgentPersona, InterviewType } from '../types';

// Test configuration
interface TestConfig {
  serverURL: string;
  modelName: string;
  useNaturalLanguagePrompts: boolean; // true = prompt2.json, false = prompts.json
  verbose: boolean;
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
  private mockResponses: Map<string, string> = new Map();

  setMockResponse(promptSignature: string, response: string) {
    this.mockResponses.set(promptSignature, response);
  }

  async sendMessage(messages: any[], options?: any): Promise<string> {
    // In a real test, this would call the actual Lemonade server
    // For now, return a mock persona
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    if (lastMessage.includes('Generate interview intelligence')) {
      return this.generateMockPersona(lastMessage);
    }
    
    if (lastMessage.includes('greeting') || lastMessage.includes('background')) {
      return "Hey, can you hear me okay? Thanks for taking the time today. We have about 30 minutes — I'll ask some questions, then save time at the end for yours. Tell me about your background and what drew you to this role.";
    }
    
    return "Tell me more about that.";
  }

  private generateMockPersona(promptText: string): string {
    // Extract company and position from prompt
    const companyMatch = promptText.match(/Company:\s*(.+)/);
    const positionMatch = promptText.match(/Position:\s*(.+)/);
    
    const company = companyMatch ? companyMatch[1].trim() : 'TechCorp';
    const position = positionMatch ? positionMatch[1].trim() : 'Software Engineer';

    return JSON.stringify({
      personaName: "Sarah Chen",
      personaRole: `Engineering Manager at ${company}, 8 years experience`,
      gender: "female",
      interviewStyle: "challenging",
      questionDifficulty: "medium",
      primaryProbeArea: `Core technical and leadership competencies for ${position}`,
      mustCoverTopic1: "System design and architecture",
      mustCoverTopic2: "Team collaboration and communication",
      mustCoverTopic3: `Technical depth relevant to ${position}`,
      validateClaim1: "Led team of 5 engineers — probe for actual leadership depth",
      validateClaim2: "Improved performance by 40% — ask for specific metrics",
      watchSignal1: "Level of ownership vs blame-shifting",
      watchSignal2: "Technical depth vs buzzword usage",
      q1Topic: `Tell me about your background and what drew you to the ${position} role at ${company}. Calibrate depth based on response clarity.`,
      q2Topic: `Describe a complex system you designed. Probe: architecture decisions, trade-offs considered, how you measured success.`,
      q3Topic: `Tell me about a time you had to lead through a difficult situation. Use STAR structure. Probe specific actions and outcomes.`,
      q4Topic: `Walk me through your experience with [specific claim from resume]. Challenge vague answers — ask for exact decisions and outcomes.`,
      q5Topic: `How would you design a scalable solution for [complex scenario]? Walk through your thinking. Then: What questions do you have for me?`,
      jobAnalysis: `This ${position} role at ${company} requires strong system design skills, leadership experience, and deep technical expertise in distributed systems.`,
      resumeAnalysis: `Candidate shows strong technical background with relevant experience. Alignment with role requirements is good, with particular strength in system design.`
    }, null, 2);
  }
}

/**
 * Test Harness for Interview Prompts
 */
export class PromptTestHarness {
  private config: TestConfig;
  private results: TestResult[] = [];
  private mockClient: MockLemonadeClient;
  private prompts: any;

  constructor(config: TestConfig) {
    this.config = config;
    this.mockClient = new MockLemonadeClient();
    this.loadPrompts();
  }

  private loadPrompts(): void {
    const promptFile = this.config.useNaturalLanguagePrompts 
      ? 'prompt2.json' 
      : 'prompts.json';
    
    const promptPath = path.join(__dirname, '..', 'data', promptFile);
    
    if (!fs.existsSync(promptPath)) {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }
    
    const content = fs.readFileSync(promptPath, 'utf-8');
    this.prompts = JSON.parse(content);
    
    if (this.config.verbose) {
      console.log(`\n✓ Loaded prompts from ${promptFile}`);
      console.log(`  - Using ${this.config.useNaturalLanguagePrompts ? 'natural language' : 'UCL/coded'} format`);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('       PROMPT TEST HARNESS - INTERVIEW FLOW TESTING');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nConfiguration:`);
    console.log(`  Server URL: ${this.config.serverURL}`);
    console.log(`  Model: ${this.config.modelName}`);
    console.log(`  Prompt Version: ${this.config.useNaturalLanguagePrompts ? 'prompt2.json (natural)' : 'prompts.json (UCL)'}`);
    console.log(`  Verbose: ${this.config.verbose}`);
    console.log('');

    // Test 1: Prompt JSON Validity
    await this.test('Prompt JSON Validity', () => {
      if (!this.prompts) throw new Error('Failed to load prompts');
      if (!this.prompts.persona?.generation?.systemPrompt) {
        throw new Error('Missing persona.generation.systemPrompt');
      }
      if (!this.prompts.interview?.systemPrompt?.withPersona) {
        throw new Error('Missing interview.systemPrompt.withPersona');
      }
      return { valid: true, sections: Object.keys(this.prompts) };
    });

    // Test 2: Persona Generation Structure
    await this.test('Persona Generation Structure', () => {
      const systemPrompt = this.prompts.persona.generation.systemPrompt.join('\n');
      
      const checks = {
        has19Fields: systemPrompt.includes('19') || systemPrompt.includes('nineteen'),
        hasPhase1: systemPrompt.includes('Phase 1') || systemPrompt.includes('q1Topic'),
        hasPhase2: systemPrompt.includes('Phase 2') || systemPrompt.includes('q2Topic'),
        hasPhase3: systemPrompt.includes('Phase 3') || systemPrompt.includes('q3Topic'),
        hasPhase4: systemPrompt.includes('Phase 4') || systemPrompt.includes('q4Topic'),
        hasPhase5: systemPrompt.includes('Phase 5') || systemPrompt.includes('q5Topic'),
        hasAdaptiveFollowups: systemPrompt.includes('adaptive') || systemPrompt.includes('follow-up'),
        hasJsonRequirement: systemPrompt.includes('JSON') || systemPrompt.includes('{'),
      };
      
      const missing = Object.entries(checks)
        .filter(([_, found]) => !found)
        .map(([key]) => key);
      
      if (missing.length > 0) {
        throw new Error(`Missing required elements: ${missing.join(', ')}`);
      }
      
      return { checks, allPassed: true };
    });

    // Test 3: Mock Persona Generation
    await this.test('Mock Persona Generation', async () => {
      const jobDescription = `Senior Software Engineer at Stripe
        
        We are looking for an experienced engineer to build scalable payment systems.
        Requirements:
        - 5+ years experience with distributed systems
        - Strong system design skills
        - Experience with payment processing or fintech
        - Leadership experience (managed small teams)
        - TypeScript, Node.js, PostgreSQL`;
      
      const resume = `John Doe - Software Engineer
        
        Experience:
        - 6 years at TechCorp building payment APIs
        - Led team of 5 engineers for 2 years
        - Improved API performance by 40%
        - Built distributed transaction system handling $1B/year
        - Skills: TypeScript, Node.js, PostgreSQL, System Design`;

      const personaGen = new PersonaGeneratorService(this.mockClient as any);
      
      const result = await personaGen.generatePersona({
        jobDescriptionText: jobDescription,
        resumeText: resume,
        interviewType: 'technical' as InterviewType,
        company: 'Stripe',
        position: 'Senior Software Engineer',
      });

      // Validate structure
      if (!result.persona.name) throw new Error('Missing persona name');
      if (!result.persona.q1Topic) throw new Error('Missing q1Topic (Phase 1)');
      if (!result.persona.q2Topic) throw new Error('Missing q2Topic (Phase 2)');
      if (!result.persona.q3Topic) throw new Error('Missing q3Topic (Phase 3)');
      if (!result.persona.q4Topic) throw new Error('Missing q4Topic (Phase 4)');
      if (!result.persona.q5Topic) throw new Error('Missing q5Topic (Phase 5)');
      
      return {
        personaName: result.persona.name,
        personaRole: result.persona.personaRole,
        phases: ['q1Topic', 'q2Topic', 'q3Topic', 'q4Topic', 'q5Topic'].map(q => ({
          field: q,
          present: !!result.persona[q as keyof AgentPersona],
          preview: (result.persona[q as keyof AgentPersona] as string)?.substring(0, 60) + '...'
        })),
        jobAnalysis: result.jobAnalysis?.substring(0, 100),
        resumeAnalysis: result.resumeAnalysis?.substring(0, 100),
      };
    });

    // Test 4: Interview System Prompt Structure
    await this.test('Interview System Prompt Structure', () => {
      const withPersona = this.prompts.interview.systemPrompt.withPersona.join('\n');
      
      const checks = {
        hasCharacterRule: withPersona.includes('NEVER identify yourself as an AI') || 
                         withPersona.includes('Stay in character'),
        hasMax3Sentences: withPersona.includes('3 sentences') || withPersona.includes('Max 3'),
        hasNeutralTone: withPersona.includes('neutral') || withPersona.includes('Neutral'),
        has5PhaseArc: withPersona.includes('5 phase') || withPersona.includes('Phase 1') || withPersona.includes('q1Topic'),
        hasVagueHandling: withPersona.includes('vague') || withPersona.includes('shallow'),
        hasResumeValidation: withPersona.includes('resume') || withPersona.includes('validate'),
        hasWrapUp: withPersona.includes('wrap-up') || withPersona.includes('closing'),
        hasTimeManagement: withPersona.includes('time') || withPersona.includes('minutes'),
      };
      
      const missing = Object.entries(checks)
        .filter(([_, found]) => !found)
        .map(([key]) => key);
      
      if (missing.length > 0) {
        throw new Error(`Missing required elements: ${missing.join(', ')}`);
      }
      
      return { checks, allPassed: true };
    });

    // Test 5: Conversation Flow Simulation
    await this.test('Conversation Flow Simulation', async () => {
      // Simulate a simple 3-exchange interview
      const exchanges = [];
      
      // Exchange 1: Greeting
      const greeting = await this.mockClient.sendMessage([
        { role: 'system', content: this.prompts.interview.systemPrompt.withPersona.join('\n') },
        { role: 'user', content: 'greeting' }
      ]);
      
      exchanges.push({ turn: 1, role: 'interviewer', message: greeting });
      
      // Check greeting has 3 steps (audio check, rapport, overview)
      const hasAudioCheck = greeting.toLowerCase().includes('hear me') || 
                           greeting.toLowerCase().includes('okay');
      const hasRapport = greeting.toLowerCase().includes('thank') || 
                        greeting.toLowerCase().includes('time');
      const hasOverview = greeting.toLowerCase().includes('minutes') || 
                         greeting.toLowerCase().includes('questions');
      
      if (!hasAudioCheck) throw new Error('Missing audio check in greeting');
      
      return {
        totalExchanges: exchanges.length,
        greetingLength: greeting.length,
        greetingSteps: { hasAudioCheck, hasRapport, hasOverview },
        sample: greeting.substring(0, 100) + '...'
      };
    });

    // Test 6: Compare Natural vs Coded Prompts (if both available)
    if (this.config.useNaturalLanguagePrompts) {
      await this.test('Natural Language Clarity', () => {
        const systemPrompt = this.prompts.persona.generation.systemPrompt.join('\n');
        
        // Natural language prompts should have:
        const checks = {
          hasReadableSections: systemPrompt.includes('IDENTITY FIELDS') || 
                              systemPrompt.includes('INTERVIEW PHASE ARC'),
          hasExamples: systemPrompt.includes('e.g.,') || systemPrompt.includes('Example:'),
          hasPlainLanguage: !systemPrompt.includes('[[ENFORCE:') && !systemPrompt.includes('^^CONDITION:'),
          hasExplanations: systemPrompt.includes('Purpose:') || systemPrompt.includes('- Purpose:'),
          hasDurationGuidance: systemPrompt.includes('minutes') || systemPrompt.includes('Duration:'),
        };
        
        return { checks, isNaturalLanguage: checks.hasPlainLanguage };
      });
    }

    // Print results
    this.printResults();
  }

  private async test(name: string, testFn: () => Promise<any> | any): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        passed: true,
        name,
        duration,
        details: result
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
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`✗ ${name} (${duration}ms)`);
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const config: TestConfig = {
    serverURL: process.env.LEMONADE_SERVER_URL || 'http://localhost:8000',
    modelName: process.env.LEMONADE_MODEL || 'Qwen2.5-7B-Instruct',
    useNaturalLanguagePrompts: args.includes('--natural') || args.includes('-n'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
  
  console.log('Prompt Test Harness');
  console.log('===================\n');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npx ts-node src/test/prompt-test-harness.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --natural, -n     Use natural language prompts (prompt2.json)');
    console.log('  --verbose, -v     Show detailed test output');
    console.log('  --help, -h        Show this help');
    console.log('');
    console.log('Environment Variables:');
    console.log('  LEMONADE_SERVER_URL   Lemonade server URL (default: http://localhost:8000)');
    console.log('  LEMONADE_MODEL        Model name to test with (default: Qwen2.5-7B-Instruct)');
    process.exit(0);
  }
  
  const harness = new PromptTestHarness(config);
  harness.runAllTests().catch(err => {
    console.error('Test harness failed:', err);
    process.exit(1);
  });
}

export { TestConfig, TestResult };
