import { InterviewerSettings, Message, InterviewFeedback, QuestionFeedback, ModelConfig, Interview, AgentPersona } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { InterviewRepository } from '../database/repositories/InterviewRepository';
import { PromptManager } from './PromptManager';

export class InterviewService {
  private lemonadeClient: LemonadeClient;
  private activeInterviews: Map<string, InterviewSession> = new Map();
  private settings: InterviewerSettings;
  private interviewRepo: InterviewRepository;

  /* ── Context-window management ──────────────────────────────────────
   * With a 4K context window, we must ensure the combined size of
   *   system prompt + conversation history + model output
   * stays within budget.  We use a sliding window: always keep the
   * system message(s), then retain only the most recent N exchange
   * pairs (user + assistant).  The full transcript is preserved in
   * session.messages for feedback generation and persistence.
   *
   * Budget estimate (4 096 tokens):
   *   System prompt ≈ 400-800 tokens
   *   6 Q&A pairs  ≈ 2 400 tokens  (avg ~400 tok/pair)
   *   Output reserve = max_tokens (default 1 000)
   *   ─────────────────────────────
   *   Total ≈ 3 800-4 200 → tight fit
   */
  private static readonly MAX_CONTEXT_PAIRS = 4;

  constructor(settings: InterviewerSettings, interviewRepo: InterviewRepository) {
    this.settings = settings;
    this.interviewRepo = interviewRepo;
    this.lemonadeClient = new LemonadeClient(settings);
  }

  /**
   * Build a windowed view of the conversation for the model.
   * Keeps all system messages + the last `maxPairs` exchange pairs.
   * Does NOT mutate the original array.
   */
  private buildWindowedMessages(
    messages: Message[],
    maxPairs: number = InterviewService.MAX_CONTEXT_PAIRS,
  ): Message[] {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const history    = messages.filter(m => m.role !== 'system');

    if (history.length <= maxPairs * 2) {
      // Conversation is short enough — send everything
      return messages;
    }

    // Keep only the most recent messages (pairs of user + assistant)
    const trimmed = history.slice(-(maxPairs * 2));
    return [...systemMsgs, ...trimmed];
  }

  /**
   * Rough token estimator (~3.5 chars per token for English text).
   * Used as a safety check, not a precise tokenizer.
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Token-aware trimming: walks backward from the newest messages,
   * keeping as many as fit within the token budget.
   * Always preserves system messages.
   */
  private trimToTokenBudget(messages: Message[], ctxSize: number = 4096): Message[] {
    const systemMsgs  = messages.filter(m => m.role === 'system');
    const history      = messages.filter(m => m.role !== 'system');

    const systemTokens = systemMsgs.reduce(
      (sum, m) => sum + InterviewService.estimateTokens(m.content), 0,
    );
    const outputReserve = this.settings.maxTokens || 2000;
    let budget = ctxSize - systemTokens - outputReserve;

    const kept: Message[] = [];
    for (let i = history.length - 1; i >= 0 && budget > 0; i--) {
      const cost = InterviewService.estimateTokens(history[i].content);
      if (cost <= budget) {
        kept.unshift(history[i]);
        budget -= cost;
      } else {
        break;
      }
    }

    return [...systemMsgs, ...kept];
  }

  /**
   * Get the LemonadeClient instance (used by PersonaGeneratorService).
   */
  getLemonadeClient(): LemonadeClient {
    return this.lemonadeClient;
  }

  async startInterview(interviewId: string, config: Partial<Interview>, persona?: AgentPersona | null): Promise<void> {
    const systemPrompt = this.buildSystemPrompt(config, persona);
    const session: InterviewSession = {
      interviewId,
      messages: [
        {
          id: Date.now().toString(),
          role: 'system',
          content: systemPrompt,
          timestamp: new Date().toISOString(),
        },
      ],
      questionCount: 0,
    };

    this.activeInterviews.set(interviewId, session);

    // Send initial greeting
    // Note: session.messages already has the system prompt
    const greeting = await this.lemonadeClient.sendMessage(
      session.messages
    );

    session.messages.push({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    });
  }

  async sendMessage(interviewId: string, userMessage: string): Promise<string> {
    const session = this.activeInterviews.get(interviewId);
    if (!session) {
      throw new Error('Interview session not found');
    }

    // Add user message to the full transcript (never trimmed)
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    // Get AI response
    // Use a small context window (approx 3k tokens) for snappy "Time to First Token"
    // during the active interview loop.
    const response = await this.lemonadeClient.sendMessage(
      session.messages,
      { maxInputTokens: 3072 }
    );

    // Add assistant message
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
   *
   * Tokens are forwarded to `onToken` as they arrive from the LLM so the
   * caller can pipeline them to TTS.  The full (cleaned) response is
   * returned once the stream ends.
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

    // Add user message to conversation
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    // Stream AI response — tokens forwarded via callback
    // Use a small context window (approx 3k tokens) for snappy "Time to First Token"
    const response = await this.lemonadeClient.sendMessageStreaming(
      session.messages,
      onToken,
      { maxInputTokens: 3072 }
    );

    // Add assistant message to in-memory session
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

    // Generate feedback
    const feedbackPrompt = PromptManager.getInstance().getFeedbackComprehensivePrompt();

    const feedbackResponse = await this.lemonadeClient.sendMessage(
      [
        ...session.messages,
        {
          id: Date.now().toString(),
          role: 'user',
          content: feedbackPrompt,
          timestamp: new Date().toISOString()
        }
      ],
      // Use maximum available context (approx 3k tokens) for high-fidelity feedback
      // This ensures the model sees as much of the interview history as possible.
      { maxInputTokens: 3072 }
    );

    // Parse feedback
    let feedback: InterviewFeedback;
    try {
      const parsed = JSON.parse(feedbackResponse);
      feedback = { ...parsed, questionFeedbacks: parsed.questionFeedbacks ?? [] };
    } catch (error) {
      // Fallback if parsing fails
      feedback = {
        overallScore: 70,
        questionFeedbacks: [],
        strengths: ['Completed the interview'],
        weaknesses: ['Unable to parse detailed feedback'],
        suggestions: ['Practice more interviews'],
        detailedFeedback: feedbackResponse,
      };
    }

    // Clean up session
    this.activeInterviews.delete(interviewId);

    return feedback;
  }

  /**
   * Generate detailed per-question feedback by grading each Q/A pair individually.
   * Emits progress events via onProgress callback for real-time UI updates.
   */
  async generateDetailedFeedback(
    _interviewId: string,
    transcript: Message[],
    onProgress: (data: { questionIndex: number; totalQuestions: number; status: string }) => void,
  ): Promise<InterviewFeedback> {
    // Extract Q/A pairs from transcript (assistant asks, user answers)
    const qaPairs: { question: string; answer: string }[] = [];
    for (let i = 0; i < transcript.length; i++) {
      const msg = transcript[i];
      if (msg.role === 'assistant' && msg.content.trim()) {
        // Look for the next user message as the answer
        const nextUser = transcript.slice(i + 1).find(m => m.role === 'user');
        if (nextUser) {
          qaPairs.push({
            question: msg.content,
            answer: nextUser.content,
          });
        }
      }
    }

    const totalQuestions = qaPairs.length;
    const questionFeedbacks: QuestionFeedback[] = [];

    // Grade each Q/A pair individually via the LLM
    for (let idx = 0; idx < qaPairs.length; idx++) {
      const { question, answer } = qaPairs[idx];
      onProgress({ questionIndex: idx, totalQuestions, status: `Grading question ${idx + 1} of ${totalQuestions}` });

      const gradingPrompt = PromptManager.getInstance().getFeedbackGradingPrompt({
        question,
        answer
      });

      try {
        const response = await this.lemonadeClient.sendMessage([
          { id: `grade-${idx}`, role: 'user', content: gradingPrompt, timestamp: new Date().toISOString() },
        ]);

        // Parse JSON from response (handle potential markdown wrapping)
        let cleaned = response.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(cleaned);
        questionFeedbacks.push({
          questionIndex: idx,
          question,
          answer,
          score: Math.max(0, Math.min(100, parsed.score ?? 50)),
          rating: parsed.rating ?? 'good',
          strengths: parsed.strengths ?? [],
          improvements: parsed.improvements ?? [],
          suggestedAnswer: parsed.suggestedAnswer ?? '',
        });
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

    // Calculate overall score as weighted average
    const overallScore = totalQuestions > 0
      ? Math.round(questionFeedbacks.reduce((sum, qf) => sum + qf.score, 0) / totalQuestions)
      : 0;

    // Aggregate strengths and weaknesses
    const allStrengths = [...new Set(questionFeedbacks.flatMap(qf => qf.strengths))].slice(0, 5);
    const allWeaknesses = [...new Set(questionFeedbacks.flatMap(qf => qf.improvements))].slice(0, 5);
    const suggestions = questionFeedbacks
      .filter(qf => qf.suggestedAnswer)
      .map((qf, i) => `Q${i + 1}: ${qf.suggestedAnswer}`)
      .slice(0, 5);

    const feedback: InterviewFeedback = {
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

    return feedback;
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

  async getSystemInfo(): Promise<any> {
    return await this.lemonadeClient.fetchSystemInfo();
  }

  async getServerHealth(): Promise<any> {
    return await this.lemonadeClient.fetchServerHealth();
  }

  async getWebSocketPort(): Promise<number | null> {
    return await this.lemonadeClient.getWebSocketPort();
  }

  async resumeInterview(interviewId: string): Promise<void> {
    // Load interview from database
    const interview = await this.interviewRepo.findById(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    // Restore session state
    if (interview.transcript && interview.transcript.length > 0) {
      this.activeInterviews.set(interviewId, {
        interviewId,
        messages: interview.transcript,
        questionCount: interview.transcript.filter(m => m.role === 'assistant').length,
      });
      console.log(`Resumed interview ${interviewId} with ${interview.transcript.length} messages`);
    }
  }

  private buildSystemPrompt(config: Partial<Interview>, persona?: AgentPersona | null): string {
    const { interviewType, position, company } = config;
    const { interviewStyle, questionDifficulty, numberOfQuestions, includeFollowUps } = this.settings;

    const followUpInstruction = includeFollowUps 
      ? 'Include follow-up questions based on candidate responses.' 
      : 'Limit follow-up questions.';

    // If we have a generated persona with a rich system prompt (from document analysis),
    // use it as the primary prompt and augment with interview settings
    if (persona?.systemPrompt) {
      return PromptManager.getInstance().getInterviewSystemPromptWithPersona({
        personaSystemPrompt: persona.systemPrompt,
        interviewType: interviewType || '',
        position: position || '',
        company: company || '',
        interviewStyle: persona.interviewStyle || interviewStyle,
        questionDifficulty: persona.questionDifficulty || questionDifficulty,
        numberOfQuestions,
        followUpInstruction
      });
    }

    // Fallback: generic prompt when no persona is available
    const styleAdjective = interviewStyle === 'supportive' ? 'encouraging' : interviewStyle === 'challenging' ? 'probing' : 'conversational';
    
    let typeSpecificInstruction = '';
    if (interviewType === 'technical') typeSpecificInstruction = 'Focus on technical skills, problem-solving abilities, and technical knowledge relevant to the role.';
    else if (interviewType === 'behavioral') typeSpecificInstruction = 'Focus on past experiences, soft skills, and how the candidate handles various situations.';
    else if (interviewType === 'system-design') typeSpecificInstruction = 'Focus on architectural thinking, scalability considerations, and system design principles.';
    else if (interviewType === 'coding') typeSpecificInstruction = 'Present coding problems and evaluate the candidate\'s approach, code quality, and problem-solving process.';

    const fallbackFollowUpInstruction = includeFollowUps 
      ? 'Include follow-up questions based on candidate responses.' 
      : 'Avoid follow-up questions unless necessary.';

    return PromptManager.getInstance().getInterviewSystemPromptFallback({
      interviewType: interviewType || '',
      position: position || '',
      company: company || '',
      interviewStyle,
      questionDifficulty,
      numberOfQuestions,
      followUpInstruction: fallbackFollowUpInstruction,
      styleAdjective,
      typeSpecificInstruction
    });
  }
}

interface InterviewSession {
  interviewId: string;
  messages: Message[];
  questionCount: number;
}
