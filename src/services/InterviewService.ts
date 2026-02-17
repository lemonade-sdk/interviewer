import { InterviewerSettings, Message, InterviewFeedback, QuestionFeedback, ModelConfig, Interview, AgentPersona } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { InterviewRepository } from '../database/repositories/InterviewRepository';

export class InterviewService {
  private lemonadeClient: LemonadeClient;
  private activeInterviews: Map<string, InterviewSession> = new Map();
  private settings: InterviewerSettings;
  private interviewRepo: InterviewRepository;

  /* ── Context-window management ──────────────────────────────────────
   * With a 16K context window, we must ensure the combined size of
   *   system prompt + conversation history + model output
   * stays within budget.  We use a sliding window: always keep the
   * system message(s), then retain only the most recent N exchange
   * pairs (user + assistant).  The full transcript is preserved in
   * session.messages for feedback generation and persistence.
   *
   * Budget estimate (16 384 tokens):
   *   System prompt ≈ 400-800 tokens
   *   6 Q&A pairs  ≈ 4 800 tokens  (avg ~400 tok/pair)
   *   Output reserve = max_tokens (default 2 000)
   *   ─────────────────────────────
   *   Total ≈ 7 200-7 600 → safe headroom
   */
  private static readonly MAX_CONTEXT_PAIRS = 6;

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
  private trimToTokenBudget(messages: Message[], ctxSize: number = 16384): Message[] {
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

    // Build a windowed view so we stay within the model's context budget.
    // session.messages keeps the full history; only the API call is trimmed.
    const windowedMessages = this.buildWindowedMessages(session.messages);

    // Get AI response
    const response = await this.lemonadeClient.sendMessage(
      windowedMessages
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
    const response = await this.lemonadeClient.sendMessageStreaming(
      session.messages,
      onToken,
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
    const feedbackPrompt = `Based on the interview conversation, provide comprehensive feedback on the candidate's performance. Include:
1. Overall score (0-100)
2. Key strengths (list 3-5 points)
3. Areas for improvement (list 3-5 points)
4. Specific suggestions for improvement
5. Detailed feedback on communication, technical knowledge, and problem-solving

Format your response as JSON with the following structure:
{
  "overallScore": number,
  "strengths": string[],
  "weaknesses": string[],
  "suggestions": string[],
  "detailedFeedback": string
}`;

    // For feedback we want as much history as possible, but still must
    // respect the context window.  Use token-aware trimming instead of
    // the tighter sliding window so that shorter interviews send the
    // full transcript while very long ones are safely capped.
    const feedbackMessages: Message[] = [
      ...session.messages,
      {
        id: Date.now().toString(),
        role: 'user',
        content: feedbackPrompt,
        timestamp: new Date().toISOString(),
      },
    ];
    const safeFeedbackMessages = this.trimToTokenBudget(feedbackMessages);

    const feedbackResponse = await this.lemonadeClient.sendMessage(
      safeFeedbackMessages
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

      const gradingPrompt = `You are an expert interview evaluator. Grade the following interview question and the candidate's answer.

QUESTION: ${question}

CANDIDATE'S ANSWER: ${answer}

Provide your evaluation as JSON with this exact structure (no markdown, no code fences, just valid JSON):
{
  "score": <number 0-100>,
  "rating": "<one of: excellent, good, needs-improvement>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "suggestedAnswer": "<a brief ideal answer or key points the candidate should have mentioned>"
}

Rules:
- score 80-100 = "excellent", 50-79 = "good", 0-49 = "needs-improvement"
- Be specific and constructive in strengths and improvements
- suggestedAnswer should be concise (2-3 sentences)`;

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

    // If we have a generated persona with a rich system prompt (from document analysis),
    // use it as the primary prompt and augment with interview settings
    if (persona?.systemPrompt) {
      return `${persona.systemPrompt}

═══════════════════════════════════════════════════════════════
INTERVIEW SESSION PARAMETERS
═══════════════════════════════════════════════════════════════
Interview type: ${interviewType}
Position: ${position}
Company: ${company}
Your interview style: ${persona.interviewStyle || interviewStyle}
Question difficulty: ${persona.questionDifficulty || questionDifficulty}
Target number of questions: ${numberOfQuestions}
${includeFollowUps ? 'Include follow-up questions based on candidate responses.' : 'Limit follow-up questions.'}

IMPORTANT BEHAVIORAL RULES:
- Start with a warm, professional greeting. Introduce yourself by name and briefly explain the interview format.
- Ask ONE question at a time. Wait for the candidate to respond before asking the next.
- Reference the candidate's specific experience from their resume when relevant.
- Probe deeper when answers are vague or when the topic is critical for the role.
- Keep track of time — wrap up naturally after ${numberOfQuestions} core questions.
- End by asking if the candidate has questions for you.
- Throughout the interview, maintain a natural conversational tone. You are a real person, not a bot.`;
    }

    // Fallback: generic prompt when no persona is available
    return `You are an experienced interviewer conducting a ${interviewType} interview for the position of ${position} at ${company}.

Your interview style is ${interviewStyle}.
Question difficulty level: ${questionDifficulty}
Number of questions to ask: ${numberOfQuestions}
${includeFollowUps ? 'Include follow-up questions based on candidate responses.' : 'Avoid follow-up questions unless necessary.'}

Guidelines:
1. Be professional and ${interviewStyle === 'supportive' ? 'encouraging' : interviewStyle === 'challenging' ? 'probing' : 'conversational'}
2. Ask relevant questions for a ${interviewType} interview
3. Listen carefully to responses and provide thoughtful follow-ups
4. Maintain a natural conversation flow
5. Take notes on the candidate's strengths and areas for improvement
6. Be respectful of the candidate's time and experience

${interviewType === 'technical' ? 'Focus on technical skills, problem-solving abilities, and technical knowledge relevant to the role.' : ''}
${interviewType === 'behavioral' ? 'Focus on past experiences, soft skills, and how the candidate handles various situations.' : ''}
${interviewType === 'system-design' ? 'Focus on architectural thinking, scalability considerations, and system design principles.' : ''}
${interviewType === 'coding' ? 'Present coding problems and evaluate the candidate\'s approach, code quality, and problem-solving process.' : ''}

Remember to keep track of the number of questions asked and wrap up the interview naturally when approaching the limit.`;
  }
}

interface InterviewSession {
  interviewId: string;
  messages: Message[];
  questionCount: number;
}
