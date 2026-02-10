import { InterviewerSettings, Message, InterviewFeedback, ModelConfig, Interview, AgentPersona } from '../types';
import { LemonadeClient } from './LemonadeClient';
import { InterviewRepository } from '../database/repositories/InterviewRepository';

export class InterviewService {
  private lemonadeClient: LemonadeClient;
  private activeInterviews: Map<string, InterviewSession> = new Map();
  private settings: InterviewerSettings;
  private interviewRepo: InterviewRepository;

  constructor(settings: InterviewerSettings, interviewRepo: InterviewRepository) {
    this.settings = settings;
    this.interviewRepo = interviewRepo;
    this.lemonadeClient = new LemonadeClient(settings);
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

    // Add user message to conversation
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    // Get AI response
    const response = await this.lemonadeClient.sendMessage(
      session.messages
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

    const feedbackResponse = await this.lemonadeClient.sendMessage(
      [
        ...session.messages,
        {
          id: Date.now().toString(),
          role: 'user',
          content: feedbackPrompt,
          timestamp: new Date().toISOString()
        }
      ]
    );

    // Parse feedback
    let feedback: InterviewFeedback;
    try {
      feedback = JSON.parse(feedbackResponse);
    } catch (error) {
      // Fallback if parsing fails
      feedback = {
        overallScore: 70,
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
