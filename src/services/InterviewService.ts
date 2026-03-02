import {
  InterviewerSettings,
  Message,
  InterviewFeedback,
  QuestionFeedback,
  ModelConfig,
  Interview,
  AgentPersona,
  InterviewPhase,
  InterviewPhaseState,
} from '../types';
import { LemonadeClient } from './LemonadeClient';
import { InterviewRepository } from '../database/repositories/InterviewRepository';
import { PromptManager } from './PromptManager';
import { StructuredExtractionService } from './StructuredExtractionService';
import { PhasePromptBuilder, PromptContext } from './PhasePromptBuilder';
import { InterviewPhaseManager, PhaseManagerContext } from './InterviewPhaseManager';

/** Default interview duration when not specified (minutes). */
const DEFAULT_TOTAL_MINUTES = 30;
/** Default wrap-up threshold when not specified (minutes from end). */
const DEFAULT_WRAP_UP_MINUTES = 5;

/** Phase keyword lookup — drives currentPhaseKeyword in UCL template. */
const PHASE_KEYWORDS: Record<string, string> = {
  greeting: 'greeting start introduction audio_check',
  '1': 'q1_active warm_up baseline',
  '2': 'q2_active core_technical primary',
  '3': 'q3_active behavioral leadership team',
  '4': 'q4_active validation resume_probe',
  '5': 'q5_active deep_dive closing_technical',
  wrap_up: 'wrap_up_signal closing_soon timer time_warning',
  mid: 'pacing_check time_update mid_session',
};

export class InterviewService {
  private lemonadeClient: LemonadeClient;
  private extractionService: StructuredExtractionService;
  private activeInterviews: Map<string, InterviewSession> = new Map();
  private settings: InterviewerSettings;
  private interviewRepo: InterviewRepository;
  private phasePromptBuilder: PhasePromptBuilder;
  private phaseManager: InterviewPhaseManager;

  constructor(settings: InterviewerSettings, interviewRepo: InterviewRepository) {
    this.settings = settings;
    this.interviewRepo = interviewRepo;
    this.lemonadeClient = new LemonadeClient(settings);
    this.extractionService = new StructuredExtractionService(this.lemonadeClient, settings.extractionModelName);
    this.phasePromptBuilder = PhasePromptBuilder.getInstance();
    this.phaseManager = new InterviewPhaseManager(this.lemonadeClient);
  }

  getLemonadeClient(): LemonadeClient {
    return this.lemonadeClient;
  }

  async startInterview(
    interviewId: string,
    config: Partial<Interview>,
    persona?: AgentPersona | null,
    timerConfig?: { totalInterviewMinutes: number; wrapUpThresholdMinutes: number },
    documents?: { jobDescription?: string; resume?: string },
  ): Promise<void> {
    const totalInterviewMinutes = timerConfig?.totalInterviewMinutes ?? DEFAULT_TOTAL_MINUTES;
    const wrapUpThresholdMinutes = timerConfig?.wrapUpThresholdMinutes ?? DEFAULT_WRAP_UP_MINUTES;

    // NEW: Use phase-aware prompting instead of old keyword system
    const initialPhase: InterviewPhase = 'phase_0_audio_check';
    const now = Date.now();

    // Calculate interview pacing allocation (v2: time-based tracking)
    const GREETING_ALLOCATION_MINUTES = 2;  // 2 minutes for 3-step opener
    const effectiveInterviewMinutes = Math.max(
      totalInterviewMinutes - wrapUpThresholdMinutes - GREETING_ALLOCATION_MINUTES,
      5  // Minimum 5 minutes for actual interview
    );
    const timePerQuestionMinutes = effectiveInterviewMinutes / (this.settings.numberOfQuestions || 10);

    // Initialize phase state
    const phaseState = this.phaseManager.initializeInterview(interviewId);

    // Build phase-aware system prompt
    const promptContext: PromptContext = {
      company: config.company ?? '',
      position: config.position ?? '',
      totalInterviewMinutes,
      currentMinutesRemaining: totalInterviewMinutes,
    };

    const systemPrompt = persona
      ? this.phasePromptBuilder.buildSystemPrompt(initialPhase, persona, phaseState, promptContext)
      : this.buildFallbackSystemPrompt(config, {
          totalInterviewMinutes,
          wrapUpThresholdMinutes,
          jobDescription: documents?.jobDescription ?? '',
          resume: documents?.resume ?? '',
        });

    const session: InterviewSession = {
      interviewId,
      messages: [
        {
          id: now.toString(),
          role: 'system',
          content: systemPrompt,
          timestamp: new Date(now).toISOString(),
        },
      ],
      // Legacy tracking (for backward compatibility)
      questionCount: 0,
      currentPhaseKeyword: 'greeting start introduction audio_check',
      // Timer state
      sessionStartMs: now,
      totalInterviewMinutes,
      wrapUpThresholdMinutes,
      midpointInjected: false,
      wrapUpInjected: false,
      // Greeting phase timing (v2)
      greetingPhaseStartMs: now,
      greetingMinDurationMs: GREETING_ALLOCATION_MINUTES * 60000,
      greetingCompleted: false,
      // Interview pacing allocation
      timePerQuestionMinutes,
      effectiveInterviewMinutes,
      // NEW: Phase-aware state
      currentPhase: initialPhase,
      phaseState,
      // Stored for resume/rebuild support
      interviewConfig: config,
      persona: persona ?? null,
      jobDescription: documents?.jobDescription ?? '',
      resume: documents?.resume ?? '',
    };

    this.activeInterviews.set(interviewId, session);

    // Generate initial greeting using phase-aware prompting
    const greeting = await this.lemonadeClient.sendMessage(session.messages);

    session.messages.push({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    });

    console.log(`[InterviewService] Started interview ${interviewId} in phase ${initialPhase}`);
  }

  async sendMessage(interviewId: string, userMessage: string): Promise<string> {
    const session = this.activeInterviews.get(interviewId);
    if (!session) {
      throw new Error('Interview session not found');
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    // NEW: Process candidate response through phase manager
    const elapsedMs = Date.now() - session.sessionStartMs;
    const elapsedMinutes = elapsedMs / 60000;
    const remainingMinutes = Math.max(0, session.totalInterviewMinutes - elapsedMinutes);

    const phaseContext: PhaseManagerContext = {
      currentMinutesRemaining: remainingMinutes,
      totalMinutes: session.totalInterviewMinutes,
      transcript: session.messages,
    };

    const transitionResult = await this.phaseManager.processCandidateResponse(
      interviewId,
      userMessage,
      phaseContext
    );

    // If phase transitioned, rebuild the system prompt
    if (transitionResult.shouldTransition && transitionResult.newPhase) {
      session.currentPhase = transitionResult.newPhase;
      await this.rebuildSystemPromptForPhase(session, remainingMinutes);
    }

    // Build messages with phase-aware system prompt
    const messagesToSend = this.buildPhaseAwareMessages(session, remainingMinutes);

    const response = await this.lemonadeClient.sendMessage(messagesToSend, { maxInputTokens: 3072 });

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMsg);
    session.questionCount++;

    return response;
  }

  /**
   * Streaming variant of sendMessage.
   * Tokens are forwarded to `onToken` as they arrive from the LLM.
   * Now with phase-aware prompting integration.
   */
  async sendMessageStreaming(
    interviewId: string,
    userMessage: string,
    onToken: (token: string) => void,
  ): Promise<string> {
    const session = this.activeInterviews.get(interviewId);
    if (!session) {
      throw new Error('Interview session not found');
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    // NEW: Process candidate response through phase manager
    const elapsedMs = Date.now() - session.sessionStartMs;
    const elapsedMinutes = elapsedMs / 60000;
    const remainingMinutes = Math.max(0, session.totalInterviewMinutes - elapsedMinutes);

    const phaseContext: PhaseManagerContext = {
      currentMinutesRemaining: remainingMinutes,
      totalMinutes: session.totalInterviewMinutes,
      transcript: session.messages,
    };

    const transitionResult = await this.phaseManager.processCandidateResponse(
      interviewId,
      userMessage,
      phaseContext
    );

    // If phase transitioned, rebuild the system prompt
    if (transitionResult.shouldTransition && transitionResult.newPhase) {
      session.currentPhase = transitionResult.newPhase;
      await this.rebuildSystemPromptForPhase(session, remainingMinutes);
    }

    // Build messages with phase-aware system prompt
    const messagesToSend = this.buildPhaseAwareMessages(session, remainingMinutes);

    const response = await this.lemonadeClient.sendMessageStreaming(
      messagesToSend,
      onToken,
      { maxInputTokens: 3072 },
    );

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMsg);
    session.questionCount++;

    return response;
  }

  async endInterview(interviewId: string): Promise<InterviewFeedback> {
    const session = this.activeInterviews.get(interviewId);
    if (!session) {
      throw new Error('Interview session not found');
    }

    // Stage 1: Generate natural language feedback
    // NEW: Use PhasePromptBuilder for comprehensive feedback
    const feedbackSystemPrompt = PhasePromptBuilder.getInstance().getFeedbackComprehensiveSystemPrompt();

    const feedbackText = await this.lemonadeClient.sendMessage(
      [
        ...session.messages,
        {
          id: 'feedback-system',
          role: 'system',
          content: feedbackSystemPrompt,
          timestamp: new Date().toISOString(),
        },
        {
          id: Date.now().toString(),
          role: 'user',
          content: 'Generate comprehensive post-interview feedback based on this interview transcript.',
          timestamp: new Date().toISOString(),
        },
      ],
      { maxInputTokens: 3072 },
    );

    // Stage 2: Extract structured data from natural language feedback
    const extracted = await this.extractionService.extractFeedbackData(feedbackText);

    const feedback: InterviewFeedback = {
      overallScore: extracted?.overallScore ?? 70,
      questionFeedbacks: [],
      strengths: extracted?.strengths ?? ['Completed the interview'],
      weaknesses: extracted?.weaknesses ?? ['Unable to extract detailed feedback'],
      suggestions: extracted?.suggestions ?? ['Practice more interviews'],
      detailedFeedback: feedbackText,
    };

    // Clean up phase manager state
    this.phaseManager.cleanupInterview(interviewId);

    this.activeInterviews.delete(interviewId);

    return feedback;
  }

  /**
   * Generate detailed per-question feedback by grading each Q/A pair individually.
   * Uses split systemPrompt + userPrompt for the grading call (v8.1 breaking change).
   */
  async generateDetailedFeedback(
    _interviewId: string,
    transcript: Message[],
    onProgress: (data: { questionIndex: number; totalQuestions: number; status: string }) => void,
  ): Promise<InterviewFeedback> {
    const qaPairs: { question: string; answer: string }[] = [];
    for (let i = 0; i < transcript.length; i++) {
      const msg = transcript[i];
      if (msg.role === 'assistant' && msg.content.trim()) {
        const nextUser = transcript.slice(i + 1).find(m => m.role === 'user');
        if (nextUser) {
          qaPairs.push({ question: msg.content, answer: nextUser.content });
        }
      }
    }

    const totalQuestions = qaPairs.length;
    const questionFeedbacks: QuestionFeedback[] = [];

    for (let idx = 0; idx < qaPairs.length; idx++) {
      const { question, answer } = qaPairs[idx];
      onProgress({ questionIndex: idx, totalQuestions, status: `Grading question ${idx + 1} of ${totalQuestions}` });

      try {
        // NEW: Use PhasePromptBuilder for question grading
        const feedbackText = await this.lemonadeClient.sendMessage([
          {
            id: `grade-sys-${idx}`,
            role: 'system',
            content: PhasePromptBuilder.getInstance().getFeedbackGradingSystemPrompt(),
            timestamp: new Date().toISOString(),
          },
          {
            id: `grade-${idx}`,
            role: 'user',
            content: PhasePromptBuilder.getInstance().getFeedbackGradingUserPrompt({ question, answer }),
            timestamp: new Date().toISOString(),
          },
        ]);

        const extracted = await this.extractionService.extractQuestionGrade(question, answer, feedbackText);

        if (extracted) {
          questionFeedbacks.push({
            questionIndex: idx,
            question,
            answer,
            score: extracted.score,
            rating: extracted.rating,
            strengths: extracted.strengths,
            improvements: extracted.improvements,
            suggestedAnswer: extracted.suggestedAnswer,
          });
        } else {
          questionFeedbacks.push({
            questionIndex: idx,
            question,
            answer,
            score: 50,
            rating: 'good',
            strengths: ['Response provided'],
            improvements: [`Feedback: ${feedbackText.substring(0, 200)}`],
            suggestedAnswer: '',
          });
        }
      } catch (error) {
        console.error(`Failed to grade Q${idx + 1}:`, error);
        questionFeedbacks.push({
          questionIndex: idx,
          question,
          answer,
          score: 50,
          rating: 'good',
          strengths: ['Completed the question'],
          improvements: ['Unable to generate detailed feedback for this question'],
          suggestedAnswer: '',
        });
      }
    }

    onProgress({ questionIndex: totalQuestions, totalQuestions, status: 'Calculating final score...' });

    const overallScore = totalQuestions > 0
      ? Math.round(questionFeedbacks.reduce((sum, qf) => sum + qf.score, 0) / totalQuestions)
      : 0;

    const allStrengths = [...new Set(questionFeedbacks.flatMap(qf => qf.strengths))].slice(0, 5);
    const allWeaknesses = [...new Set(questionFeedbacks.flatMap(qf => qf.improvements))].slice(0, 5);
    const suggestions = questionFeedbacks
      .filter(qf => qf.suggestedAnswer)
      .map((qf, i) => `Q${i + 1}: ${qf.suggestedAnswer}`)
      .slice(0, 5);

    return {
      overallScore,
      questionFeedbacks,
      strengths: allStrengths,
      weaknesses: allWeaknesses,
      suggestions,
      detailedFeedback: `Interview scored ${overallScore}% across ${totalQuestions} questions. ${
        overallScore >= 80
          ? 'Excellent performance overall.'
          : overallScore >= 60
            ? 'Good performance with room for improvement.'
            : 'Needs significant improvement in several areas.'
      }`,
    };
  }

  async getAvailableModels(): Promise<ModelConfig[]> {
    return await this.lemonadeClient.getAvailableModels();
  }

  async testModelConnection(modelId: string): Promise<boolean> {
    return await this.lemonadeClient.testConnection(modelId);
  }

  async loadModel(modelId: string, options?: {
    ctx_size?: number;
    llamacpp_backend?: 'vulkan' | 'rocm' | 'metal' | 'cpu';
    llamacpp_args?: string;
    save_options?: boolean;
  }): Promise<{ success: boolean; message?: string }> {
    return await this.lemonadeClient.loadModel(modelId, options);
  }

  async unloadModel(modelId: string): Promise<{ success: boolean; message?: string }> {
    return await this.lemonadeClient.unloadModel(modelId);
  }

  async pullModel(modelId: string): Promise<{ success: boolean; message?: string }> {
    return await this.lemonadeClient.pullModel(modelId);
  }

  async pullModelStreaming(
    modelId: string,
    onProgress: (data: {
      file?: string;
      fileIndex?: number;
      totalFiles?: number;
      bytesDownloaded?: number;
      bytesTotal?: number;
      percent: number;
    }) => void,
  ): Promise<{ success: boolean; message?: string }> {
    return await this.lemonadeClient.pullModelStreaming(modelId, onProgress);
  }

  async deleteModel(modelId: string): Promise<{ success: boolean; message?: string }> {
    return await this.lemonadeClient.deleteModel(modelId);
  }

  async refreshModels(): Promise<ModelConfig[]> {
    return await this.lemonadeClient.fetchAvailableModels();
  }

  async listAllModels() {
    return await this.lemonadeClient.listAllModels();
  }

  async checkServerHealth(): Promise<boolean> {
    return await this.lemonadeClient.checkServerHealth();
  }

  async getSystemInfo(): Promise<unknown> {
    return await this.lemonadeClient.fetchSystemInfo();
  }

  async getServerHealth(): Promise<unknown> {
    return await this.lemonadeClient.fetchServerHealth();
  }

  async getWebSocketPort(): Promise<number | null> {
    return await this.lemonadeClient.getWebSocketPort();
  }

  async resumeInterview(interviewId: string): Promise<void> {
    const interview = await this.interviewRepo.findById(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    if (interview.transcript && interview.transcript.length > 0) {
      const now = Date.now();
      const questionCount = interview.transcript.filter(m => m.role === 'assistant').length;
      const effectiveInterviewMinutes = Math.max(
        DEFAULT_TOTAL_MINUTES - DEFAULT_WRAP_UP_MINUTES - 2,
        5
      );
      const timePerQuestionMinutes = effectiveInterviewMinutes / (this.settings.numberOfQuestions || 10);

      // NEW: Restore phase state from transcript
      const elapsedMinutes = (now - new Date(interview.startedAt).getTime()) / 60000;
      const phaseState = this.phaseManager.restorePhaseState(
        interviewId,
        interview.transcript,
        DEFAULT_TOTAL_MINUTES,
        elapsedMinutes
      );

      this.activeInterviews.set(interviewId, {
        interviewId,
        messages: interview.transcript,
        questionCount,
        currentPhaseKeyword: this.getPhaseKeyword(questionCount),
        sessionStartMs: now,
        totalInterviewMinutes: DEFAULT_TOTAL_MINUTES,
        wrapUpThresholdMinutes: DEFAULT_WRAP_UP_MINUTES,
        midpointInjected: false,
        wrapUpInjected: false,
        // Greeting phase timing (v2)
        greetingPhaseStartMs: now,
        greetingMinDurationMs: 2 * 60000,
        greetingCompleted: questionCount > 0,
        // Interview pacing allocation
        timePerQuestionMinutes,
        effectiveInterviewMinutes,
        // NEW: Phase-aware state
        currentPhase: phaseState.currentPhase,
        phaseState,
        interviewConfig: {},
        persona: null,
        jobDescription: '',
        resume: '',
      });
      console.log(`Resumed interview ${interviewId} with ${interview.transcript.length} messages in phase ${phaseState.currentPhase}`);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Map question count to topic-phase keyword string.
   * After greeting the interviewer starts Q1; each phase spans ~2 turns.
   */
  private getPhaseKeyword(questionCount: number): string {
    if (questionCount === 0) return PHASE_KEYWORDS['greeting'];
    if (questionCount <= 2) return PHASE_KEYWORDS['1'];
    if (questionCount <= 4) return PHASE_KEYWORDS['2'];
    if (questionCount <= 6) return PHASE_KEYWORDS['3'];
    if (questionCount <= 8) return PHASE_KEYWORDS['4'];
    return PHASE_KEYWORDS['5'];
  }

  // ========== Phase-aware helper methods ==========

  /**
   * Rebuild system prompt for current phase
   */
  private async rebuildSystemPromptForPhase(
    session: InterviewSession,
    remainingMinutes: number
  ): Promise<void> {
    if (!session.persona) return;

    const promptContext: PromptContext = {
      company: session.interviewConfig.company ?? '',
      position: session.interviewConfig.position ?? '',
      totalInterviewMinutes: session.totalInterviewMinutes,
      currentMinutesRemaining: remainingMinutes,
    };

    const phaseState = this.phaseManager.getPhaseState(session.interviewId);
    if (!phaseState) return;

    const newSystemPrompt = this.phasePromptBuilder.buildSystemPrompt(
      session.currentPhase,
      session.persona,
      phaseState,
      promptContext
    );

    // Replace the system message
    const systemIndex = session.messages.findIndex(m => m.role === 'system');
    if (systemIndex >= 0) {
      session.messages[systemIndex] = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: newSystemPrompt,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Insert at beginning
      session.messages.unshift({
        id: `system-${Date.now()}`,
        role: 'system',
        content: newSystemPrompt,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[InterviewService] Rebuilt system prompt for phase ${session.currentPhase}`);
  }

  /**
   * Build messages array with phase-aware system prompt
   */
  private buildPhaseAwareMessages(session: InterviewSession, remainingMinutes: number): Message[] {
    // Start with current messages
    const messagesToSend: Message[] = [...session.messages];

    // Check for midpoint signal
    const midpointThreshold = session.totalInterviewMinutes / 2;
    if (!session.midpointInjected && remainingMinutes <= midpointThreshold) {
      messagesToSend.push({
        id: `timer-mid-${Date.now()}`,
        role: 'system',
        content: `<timer_update>pacing_check time_update mid_session - ${Math.round(remainingMinutes)} minutes remaining</timer_update>`,
        timestamp: new Date().toISOString(),
      });
      session.midpointInjected = true;
    }

    // Check for wrap-up signal
    if (!session.wrapUpInjected && remainingMinutes <= session.wrapUpThresholdMinutes) {
      messagesToSend.push({
        id: `timer-wrap-${Date.now()}`,
        role: 'system',
        content: `<timer_signal>wrap_up_signal closing_soon timer time_warning - ${Math.round(remainingMinutes)} minutes remaining</timer_signal>`,
        timestamp: new Date().toISOString(),
      });
      session.wrapUpInjected = true;
    }

    return messagesToSend;
  }

  /**
   * Fallback system prompt builder when phase prompts aren't available
   */
  private buildFallbackSystemPrompt(
    config: Partial<Interview>,
    timerContext: {
      totalInterviewMinutes: number;
      wrapUpThresholdMinutes: number;
      jobDescription: string;
      resume: string;
    }
  ): string {
    const { interviewType, position, company } = config;
    const { interviewStyle, questionDifficulty, numberOfQuestions } = this.settings;

    return PromptManager.getInstance().getInterviewSystemPromptFallback({
      interviewType: interviewType ?? '',
      position: position ?? '',
      company: company ?? '',
      interviewStyle,
      questionDifficulty,
      numberOfQuestions,
      wrapUpThresholdMinutes: timerContext.wrapUpThresholdMinutes,
      currentMinutesRemaining: timerContext.totalInterviewMinutes,
      currentPhaseKeyword: 'greeting start introduction audio_check',
      jobDescription: timerContext.jobDescription,
      resume: timerContext.resume,
    });
  }

  /**
   * Get current phase for an interview
   */
  getCurrentPhase(interviewId: string): InterviewPhase | null {
    const session = this.activeInterviews.get(interviewId);
    return session?.currentPhase ?? null;
  }

  /**
   * Get phase statistics for debugging
   */
  getPhaseStats(interviewId: string) {
    return this.phaseManager.getPhaseStats(interviewId);
  }

}

interface InterviewSession {
  interviewId: string;
  messages: Message[];
  // Legacy tracking (backward compatibility)
  questionCount: number;
  currentPhaseKeyword: string;
  // Timer state
  sessionStartMs: number;
  totalInterviewMinutes: number;
  wrapUpThresholdMinutes: number;
  midpointInjected: boolean;
  wrapUpInjected: boolean;
  // Greeting phase timing (v2: time-based tracking for coherent UX)
  greetingPhaseStartMs: number;
  greetingMinDurationMs: number;        // Default: 2 minutes (120000 ms)
  greetingCompleted: boolean;           // Whether 3-step opener is done
  // Interview pacing allocation
  timePerQuestionMinutes: number;      // Calculated: ~2-3 min per question
  effectiveInterviewMinutes: number;     // total - wrapUp - greeting allocation
  // NEW: Phase-aware state
  currentPhase: InterviewPhase;
  phaseState: InterviewPhaseState;
  // Stored for resume/rebuild support
  interviewConfig: Partial<Interview>;
  persona: AgentPersona | null;
  jobDescription: string;
  resume: string;
}
