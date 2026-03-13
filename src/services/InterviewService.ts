import { InterviewerSettings, Message, InterviewFeedback, QuestionFeedback, ModelConfig, Interview, AgentPersona } from '../types';
import { LemonadeClient, INTERVIEW_MAX_INPUT_TOKENS, FEEDBACK_MAX_INPUT_TOKENS } from './LemonadeClient';
import { InterviewRepository } from '../database/repositories/InterviewRepository';
import { PromptManager } from './PromptManager';
import { StructuredExtractionService } from './StructuredExtractionService';
import { PipelineLogger } from './PipelineLogger';

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

  constructor(settings: InterviewerSettings, interviewRepo: InterviewRepository) {
    this.settings = settings;
    this.interviewRepo = interviewRepo;
    this.lemonadeClient = new LemonadeClient(settings);
    this.extractionService = new StructuredExtractionService(this.lemonadeClient, settings.extractionModelName);
  }

  getLemonadeClient(): LemonadeClient {
    return this.lemonadeClient;
  }

  async startInterview(
    interviewId: string,
    config: Partial<Interview>,
    persona?: AgentPersona | null,
    timerConfig?: { totalInterviewMinutes: number; wrapUpThresholdMinutes: number },
    documents?: { resume?: string },
  ): Promise<string> {
    const totalInterviewMinutes = timerConfig?.totalInterviewMinutes ?? DEFAULT_TOTAL_MINUTES;
    const wrapUpThresholdMinutes = timerConfig?.wrapUpThresholdMinutes ?? DEFAULT_WRAP_UP_MINUTES;

    // Greeting phase is always first — interviewer does audio check + intro before Q1
    const initialPhaseKeyword = PHASE_KEYWORDS['greeting'];
    const now = Date.now();

    // Calculate interview pacing allocation (v2: time-based tracking)
    const GREETING_ALLOCATION_MINUTES = 2;  // 2 minutes for 3-step opener
    const effectiveInterviewMinutes = Math.max(
      totalInterviewMinutes - wrapUpThresholdMinutes - GREETING_ALLOCATION_MINUTES,
      5  // Minimum 5 minutes for actual interview
    );
    const timePerQuestionMinutes = effectiveInterviewMinutes / (this.settings.numberOfQuestions || 10);

    console.log(`[Interview:start] ── Building session ─────────────────────────`);
    console.log(`[Interview:start] interviewId=${interviewId}, persona=${persona?.name ?? 'none (fallback)'}`);
    console.log(`[Interview:start] totalInterviewMinutes=${totalInterviewMinutes}, wrapUp=${wrapUpThresholdMinutes}min, effective=${effectiveInterviewMinutes}min`);
    console.log(`[Interview:start] resume: ${(documents?.resume ?? '').length} chars`);

    const systemPrompt = this.buildSystemPrompt(config, persona, {
      totalInterviewMinutes,
      wrapUpThresholdMinutes,
      currentPhaseKeyword: initialPhaseKeyword,
      resume: documents?.resume ?? '',
      // New timing variables for coherent UX
      greetingAllocationMinutes: GREETING_ALLOCATION_MINUTES,
      timePerQuestionMinutes,
      effectiveInterviewMinutes,
    });

    console.log(`[Interview:start] System prompt built: ${systemPrompt.length} chars (~${Math.round(systemPrompt.length/4)} tokens), path=${persona ? 'withPersona' : 'fallback'}`);
    console.log(`[Interview:start] System prompt preview (first 400 chars):\n${systemPrompt.substring(0, 400)}...`);

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
      questionCount: 0,
      // Timer state
      sessionStartMs: now,
      totalInterviewMinutes,
      wrapUpThresholdMinutes,
      midpointInjected: false,
      wrapUpInjected: false,
      // Greeting phase timing (v2)
      greetingPhaseStartMs: now,
      greetingMinDurationMs: GREETING_ALLOCATION_MINUTES * 60000,  // 2 min in ms
      greetingCompleted: false,
      // Interview pacing allocation
      timePerQuestionMinutes,
      effectiveInterviewMinutes,
      // Phase tracking
      currentPhaseKeyword: initialPhaseKeyword,
      // Stored for resume/rebuild support
      interviewConfig: config,
      persona: persona ?? null,
      resume: documents?.resume ?? '',
    };

    this.activeInterviews.set(interviewId, session);

    console.log(`[Interview:start] Sending initial greeting prompt (system prompt only, no user turn)...`);
    const greetingStart = Date.now();
    const greeting = await this.lemonadeClient.sendMessage(session.messages);
    const greetingDurationMs = Date.now() - greetingStart;

    console.log(`[Interview:start] Greeting received (${greeting.length} chars): "${greeting.substring(0, 200)}${greeting.length > 200 ? '...' : ''}"`);

    try {
      PipelineLogger.getInstance().log(interviewId, {
        stage: 'interview-greeting',
        model: this.settings.modelName,
        inputChars: systemPrompt.length,
        inputTokensEst: Math.round(systemPrompt.length / 4),
        maxOutputTokens: 2000,
        messageCount: 1,
        systemChars: systemPrompt.length,
        finishReason: 'stop',
        outputChars: greeting.length,
        outputPreview: greeting.substring(0, 600),
        extracted: {
          personaName: persona?.name ?? null,
          totalInterviewMinutes,
          hasResume: (documents?.resume ?? '').length > 0,
        },
        meta: { interviewId, personaId: persona?.id ?? null },
        durationMs: greetingDurationMs,
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    session.messages.push({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    });

    return greeting;
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

    const messagesToSend = this.buildMessagesWithInjections(session);

    const response = await this.lemonadeClient.sendMessage(messagesToSend, { maxInputTokens: INTERVIEW_MAX_INPUT_TOKENS });

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMsg);
    session.questionCount++;
    // Phase is advanced by buildMessagesWithInjections at the start of the NEXT turn.
    // Calling advancePhaseIfNeeded here would pre-empt that check and prevent injections.

    return response;
  }

  /**
   * Streaming variant of sendMessage.
   * Tokens are forwarded to `onToken` as they arrive from the LLM.
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

    const messagesToSend = this.buildMessagesWithInjections(session);
    const turnStart = Date.now();

    const response = await this.lemonadeClient.sendMessageStreaming(
      messagesToSend,
      onToken,
      { maxInputTokens: INTERVIEW_MAX_INPUT_TOKENS },
    );

    const turnDurationMs = Date.now() - turnStart;
    const inputChars = messagesToSend.reduce((s, m) => s + m.content.length, 0);

    try {
      PipelineLogger.getInstance().log(interviewId, {
        stage: 'interview-turn',
        model: this.settings.modelName,
        inputChars,
        inputTokensEst: Math.round(inputChars / 4),
        maxOutputTokens: 3072,
        messageCount: messagesToSend.length,
        finishReason: 'stop',
        outputChars: response.length,
        outputPreview: response.substring(0, 600),
        extracted: { turnIndex: session.questionCount, phase: session.currentPhaseKeyword },
        meta: { interviewId },
        durationMs: turnDurationMs,
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMsg);
    session.questionCount++;
    // Phase is advanced by buildMessagesWithInjections at the start of the NEXT turn.

    return response;
  }

  async endInterview(interviewId: string): Promise<InterviewFeedback> {
    const session = this.activeInterviews.get(interviewId);
    if (!session) {
      throw new Error('Interview session not found');
    }

    // Stage 1: Generate natural language feedback
    const feedbackPrompt = PromptManager.getInstance().getFeedbackComprehensivePrompt();

    const feedbackText = await this.lemonadeClient.sendMessage(
      [
        ...session.messages,
        {
          id: Date.now().toString(),
          role: 'user',
          content: feedbackPrompt,
          timestamp: new Date().toISOString(),
        },
      ],
      { maxInputTokens: FEEDBACK_MAX_INPUT_TOKENS },
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
      // Skip meta turns (audio check, introduction) by requiring at least 2 prior
      // user messages before an assistant message counts as a gradeable question.
      // Works for both the new pre-generated greeting flow and the legacy "Hello." trigger.
      const priorUserCount = transcript.slice(0, i).filter(m => m.role === 'user').length;
      if (msg.role === 'assistant' && msg.content.trim() && priorUserCount >= 2) {
        const nextUser = transcript.slice(i + 1).find(m => m.role === 'user');
        if (nextUser) {
          qaPairs.push({ question: msg.content, answer: nextUser.content });
        }
      }
    }

    const totalQuestions = qaPairs.length;
    const questionFeedbacks: QuestionFeedback[] = [];
    const pm = PromptManager.getInstance();

    for (let idx = 0; idx < qaPairs.length; idx++) {
      const { question, answer } = qaPairs[idx];
      onProgress({ questionIndex: idx, totalQuestions, status: `Grading question ${idx + 1} of ${totalQuestions}` });

      try {
        const feedbackText = await this.lemonadeClient.sendMessage([
          {
            id: `grade-sys-${idx}`,
            role: 'system',
            content: pm.getFeedbackGradingSystemPrompt(),
            timestamp: new Date().toISOString(),
          },
          {
            id: `grade-${idx}`,
            role: 'user',
            content: pm.getFeedbackGradingUserPrompt({ question, answer }),
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

      this.activeInterviews.set(interviewId, {
        interviewId,
        messages: interview.transcript,
        questionCount,
        sessionStartMs: now,
        totalInterviewMinutes: DEFAULT_TOTAL_MINUTES,
        wrapUpThresholdMinutes: DEFAULT_WRAP_UP_MINUTES,
        midpointInjected: false,
        wrapUpInjected: false,
        // Greeting phase timing (v2)
        greetingPhaseStartMs: now,
        greetingMinDurationMs: 2 * 60000,  // 2 minutes
        greetingCompleted: questionCount > 0,  // If already have messages, greeting is done
        // Interview pacing allocation
        timePerQuestionMinutes,
        effectiveInterviewMinutes,
        // Phase tracking
        currentPhaseKeyword: this.getPhaseKeyword(questionCount),
        interviewConfig: {},
        persona: null,
        resume: '',
      });
      console.log(`Resumed interview ${interviewId} with ${interview.transcript.length} messages`);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Build the messages array for an API call, prepending ephemeral system
   * messages for phase updates and timer signals as needed.
   * These injections are NOT stored in session.messages so the transcript
   * and feedback pipeline stay clean.
   */
  private buildMessagesWithInjections(session: InterviewSession): Message[] {
    const messagesToSend: Message[] = [...session.messages];

    // Phase update: inject a brief system message when the phase changes
    const newPhaseKeyword = this.getPhaseKeyword(session.questionCount);

    if (newPhaseKeyword !== session.currentPhaseKeyword) {
      messagesToSend.push({
        id: `phase-${Date.now()}`,
        role: 'system',
        content: `<phase_update>current_phase: ${newPhaseKeyword}</phase_update>`,
        timestamp: new Date().toISOString(),
      });
      session.currentPhaseKeyword = newPhaseKeyword;
    }

    // Remaining time
    const elapsedMs = Date.now() - session.sessionStartMs;
    const elapsedMinutes = elapsedMs / 60000;
    const remainingMinutes = Math.max(0, session.totalInterviewMinutes - elapsedMinutes);

    // Midpoint pacing signal (~50% of total duration)
    const midpointThreshold = session.totalInterviewMinutes / 2;
    if (!session.midpointInjected && remainingMinutes <= midpointThreshold) {
      messagesToSend.push({
        id: `timer-mid-${Date.now()}`,
        role: 'system',
        content: `<timer_update>pacing_check time_update mid_session \u2014 ${Math.round(remainingMinutes)} minutes remaining</timer_update>`,
        timestamp: new Date().toISOString(),
      });
      session.midpointInjected = true;
    }

    // Wrap-up signal
    if (!session.wrapUpInjected && remainingMinutes <= session.wrapUpThresholdMinutes) {
      messagesToSend.push({
        id: `timer-wrap-${Date.now()}`,
        role: 'system',
        content: `<timer_signal>wrap_up_signal closing_soon timer time_warning \u2014 ${Math.round(remainingMinutes)} minutes remaining</timer_signal>`,
        timestamp: new Date().toISOString(),
      });
      session.wrapUpInjected = true;
    }

    return messagesToSend;
  }

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

  private buildSystemPrompt(
    config: Partial<Interview>,
    persona?: AgentPersona | null,
    timerContext?: {
      totalInterviewMinutes: number;
      wrapUpThresholdMinutes: number;
      currentPhaseKeyword: string;
      resume: string;
      // v2: Time allocation variables for coherent UX
      greetingAllocationMinutes?: number;
      timePerQuestionMinutes?: number;
      effectiveInterviewMinutes?: number;
    },
  ): string {
    const { interviewType, position, company } = config;
    const { interviewStyle, questionDifficulty, numberOfQuestions } = this.settings;

    const totalInterviewMinutes = timerContext?.totalInterviewMinutes ?? DEFAULT_TOTAL_MINUTES;
    const wrapUpThresholdMinutes = timerContext?.wrapUpThresholdMinutes ?? DEFAULT_WRAP_UP_MINUTES;
    const currentPhaseKeyword = timerContext?.currentPhaseKeyword ?? PHASE_KEYWORDS['greeting'];

    // v2: Time allocation for coherent interview pacing
    const greetingAllocationMinutes = timerContext?.greetingAllocationMinutes ?? 2;
    const timePerQuestionMinutes = timerContext?.timePerQuestionMinutes ?? 2.5;
    const effectiveInterviewMinutes = timerContext?.effectiveInterviewMinutes ?? (totalInterviewMinutes - wrapUpThresholdMinutes - 2);

    if (persona) {
      const q1Topic = persona.q1Topic ?? 'Tell me about your background and experience relevant to this role.';

      console.log(`[buildSystemPrompt] PATH: withPersona`);
      console.log(`[buildSystemPrompt] persona="${persona.name}", role="${persona.personaRole}"`);
      console.log(`[buildSystemPrompt] total_duration=${totalInterviewMinutes}min, style="${persona.interviewStyle || interviewStyle}", difficulty="${persona.questionDifficulty || questionDifficulty}"`);
      console.log(`[buildSystemPrompt] q1="${q1Topic.substring(0, 80)}..."`);
      console.log(`[buildSystemPrompt] mustCover1="${persona.mustCoverTopic1?.substring(0, 60)}", mustCover2="${persona.mustCoverTopic2?.substring(0, 60)}"`);
      console.log(`[buildSystemPrompt] resumeChars=${(timerContext?.resume ?? '').length}`);

      return PromptManager.getInstance().getInterviewSystemPromptWithPersona({
        personaName: persona.name,
        personaRole: persona.personaRole ?? `Interviewer at ${company ?? 'the company'}`,
        interviewType: interviewType ?? '',
        position: position ?? '',
        company: company ?? '',
        interviewStyle: persona.interviewStyle || interviewStyle,
        questionDifficulty: persona.questionDifficulty || questionDifficulty,
        numberOfQuestions,
        wrapUpThresholdMinutes,
        // Dynamic per-call vars — initial values; subsequent turns use ephemeral injections
        currentMinutesRemaining: totalInterviewMinutes,
        currentPhaseKeyword,
        currentTopicInstruction: currentPhaseKeyword.includes('greeting') ? '' : q1Topic,
        q1Topic,
        q2Topic: persona.q2Topic ?? 'Describe a challenging technical problem you solved.',
        q3Topic: persona.q3Topic ?? 'Tell me about a time you had to lead or collaborate under pressure.',
        q4Topic: persona.q4Topic ?? 'Walk me through a key project from your resume in detail.',
        q5Topic: persona.q5Topic ?? 'What aspects of this role excite you and what would you want to grow in?',
        primaryProbeArea: persona.primaryProbeArea ?? `Core competencies for ${position ?? 'this role'}`,
        mustCoverTopic1: persona.mustCoverTopic1 ?? 'Technical depth and problem-solving approach',
        mustCoverTopic2: persona.mustCoverTopic2 ?? 'Team collaboration and communication',
        mustCoverTopic3: persona.mustCoverTopic3 ?? 'Motivation and culture fit',
        validateClaim1: persona.validateClaim1 ?? 'Technical experience claims in resume',
        validateClaim2: persona.validateClaim2 ?? 'Leadership or ownership claims',
        watchSignal1: persona.watchSignal1 ?? 'Ownership vs. passive participation in projects',
        watchSignal2: persona.watchSignal2 ?? 'Ability to handle ambiguity and self-direct',
        resume: timerContext?.resume ?? '',
        // v2: Time allocation for coherent UX
        greetingAllocationMinutes,
        timePerQuestionMinutes,
        effectiveInterviewMinutes,
      });
    }

    // Fallback: generic prompt when no persona is available
    console.log(`[buildSystemPrompt] PATH: fallback (no persona)`);
    console.log(`[buildSystemPrompt] company="${company}", position="${position}", type="${interviewType}"`);
    console.log(`[buildSystemPrompt] resumeChars=${(timerContext?.resume ?? '').length}, total_duration=${totalInterviewMinutes}min`);

    return PromptManager.getInstance().getInterviewSystemPromptFallback({
      interviewType: interviewType ?? '',
      position: position ?? '',
      company: company ?? '',
      interviewStyle,
      questionDifficulty,
      numberOfQuestions,
      wrapUpThresholdMinutes,
      currentMinutesRemaining: totalInterviewMinutes,
      currentPhaseKeyword,
      resume: timerContext?.resume ?? '',
      // v2: Time allocation for coherent UX
      greetingAllocationMinutes,
      timePerQuestionMinutes,
      effectiveInterviewMinutes,
    });
  }
}

interface InterviewSession {
  interviewId: string;
  messages: Message[];
  questionCount: number;
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
  // Phase tracking
  currentPhaseKeyword: string;
  // Stored for resume/rebuild support
  interviewConfig: Partial<Interview>;
  persona: AgentPersona | null;
  resume: string;
}
