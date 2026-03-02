import {
  InterviewPhase,
  InterviewPhaseState,
  PhaseTransitionResult,
  Message,
  PHASE_NUMBERS,
  getNextPhase,
  isGreetingPhase,
  isInterviewPhase,
  isClosingPhase,
  createInitialPhaseState,
} from '../types';
import { PhasePromptBuilder } from './PhasePromptBuilder';
import { LemonadeClient } from './LemonadeClient';

/**
 * InterviewPhaseManager
 *
 * Manages interview phase transitions using a state machine with:
 * - Pattern-based detection for early phases (0-2)
 * - LLM-based coverage assessment for interview phases (3-7)
 * - Time-based fallbacks
 * - Exchange counting for automatic advancement
 * - Edge case detection and handling
 */
export class InterviewPhaseManager {
  private phasePromptBuilder: PhasePromptBuilder;
  private lemonadeClient: LemonadeClient;

  // State storage keyed by interview ID
  private phaseStates: Map<string, InterviewPhaseState> = new Map();

  // Timeout tracking
  private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(lemonadeClient: LemonadeClient) {
    this.phasePromptBuilder = PhasePromptBuilder.getInstance();
    this.lemonadeClient = lemonadeClient;
  }

  /**
   * Initialize phase state for a new interview
   */
  initializeInterview(interviewId: string): InterviewPhaseState {
    const state = createInitialPhaseState();
    this.phaseStates.set(interviewId, state);
    console.log(`[InterviewPhaseManager] Initialized interview ${interviewId} at phase ${state.currentPhase}`);
    return state;
  }

  /**
   * Get current phase state for an interview
   */
  getPhaseState(interviewId: string): InterviewPhaseState | undefined {
    return this.phaseStates.get(interviewId);
  }

  /**
   * Restore phase state from existing data (for resumed interviews)
   */
  restorePhaseState(
    interviewId: string,
    messages: Message[]
  ): InterviewPhaseState {
    // Attempt to rebuild phase from history
    const { phase, confidence } = this.phasePromptBuilder.rebuildPhaseFromHistory(messages);

    const state: InterviewPhaseState = {
      currentPhase: phase,
      previousPhase: null,
      phaseEnterTimeMs: Date.now(),
      exchangeCountInPhase: 0,
      totalExchangesInInterview: messages.filter(m => m.role === 'user').length,
      phaseHistory: [{
        phase,
        enteredAt: new Date().toISOString(),
        exchanges: 0,
      }],
      noResponseAttempts: 0,
      offTopicExchangeCount: 0,
      lastFollowUpSent: false,
      greetingPhaseStartMs: Date.now(),
      greetingCompleted: !isGreetingPhase(phase),
    };

    this.phaseStates.set(interviewId, state);
    console.log(`[InterviewPhaseManager] Restored interview ${interviewId} to phase ${phase} (confidence: ${confidence})`);
    return state;
  }

  /**
   * Process a candidate response and determine if phase should advance
   *
   * @param interviewId - Interview session ID
   * @param candidateResponse - The candidate's message content
   * @param context - Additional context (time remaining, etc.)
   * @returns Phase transition result
   */
  async processCandidateResponse(
    interviewId: string,
    candidateResponse: string,
    context: PhaseManagerContext
  ): Promise<PhaseTransitionResult> {
    const state = this.phaseStates.get(interviewId);
    if (!state) {
      console.error(`[InterviewPhaseManager] No state found for interview ${interviewId}`);
      return {
        shouldTransition: false,
        newPhase: null,
        reason: 'No state found',
        confidence: 'high',
      };
    }

    // Update state
    state.exchangeCountInPhase++;
    state.totalExchangesInInterview++;
    state.noResponseAttempts = 0; // Reset no-response counter on valid response

    // Get current phase config
    const phaseConfig = this.phasePromptBuilder.getPhaseConfig(state.currentPhase);
    if (!phaseConfig) {
      console.error(`[InterviewPhaseManager] No config for phase ${state.currentPhase}`);
      return {
        shouldTransition: false,
        newPhase: null,
        reason: 'Phase config not found',
        confidence: 'high',
      };
    }

    // Check for edge cases first
    const edgeCase = this.phasePromptBuilder.detectEdgeCase(
      candidateResponse,
      state.currentPhase,
      state
    );

    if (edgeCase) {
      return this.handleEdgeCase(interviewId, state, edgeCase, candidateResponse);
    }

    // Determine transition based on phase type and rules
    if (isGreetingPhase(state.currentPhase)) {
      return this.evaluateGreetingPhaseTransition(state, candidateResponse, phaseConfig);
    } else if (isInterviewPhase(state.currentPhase)) {
      return await this.evaluateInterviewPhaseTransition(
        interviewId,
        state,
        candidateResponse,
        phaseConfig,
        context
      );
    } else if (isClosingPhase(state.currentPhase)) {
      return this.evaluateClosingPhaseTransition(state, phaseConfig);
    }

    return {
      shouldTransition: false,
      newPhase: null,
      reason: 'Unknown phase type',
      confidence: 'high',
    };
  }

  /**
   * Evaluate transition for greeting phases (0-2)
   * Uses pattern-based detection (fast, reliable)
   */
  private evaluateGreetingPhaseTransition(
    state: InterviewPhaseState,
    candidateResponse: string,
    phaseConfig: ReturnType<PhasePromptBuilder['getPhaseConfig']>
  ): PhaseTransitionResult {
    if (!phaseConfig) {
      return { shouldTransition: false, newPhase: null, reason: 'No config', confidence: 'high' };
    }

    const rule = this.phasePromptBuilder.getAdvancementRule(state.currentPhase);

    // Check if candidate response matches expected patterns
    let shouldAdvance = false;
    let reason = '';

    // Pattern-based detection
    if (rule?.patterns && rule.patterns.length > 0) {
      const response = candidateResponse.toLowerCase();
      const matches = rule.patterns.some(pattern =>
        response.includes(pattern.toLowerCase())
      );

      if (matches) {
        shouldAdvance = true;
        reason = `Matched pattern: ${rule.patterns.join(', ')}`;
      }
    }

    // Any response is acceptable for some phases
    if (!shouldAdvance && rule?.any_response && candidateResponse.trim().length > 0) {
      shouldAdvance = true;
      reason = 'Any response received';
    }

    // Min exchanges check
    if (!shouldAdvance && rule?.min_exchanges) {
      if (state.exchangeCountInPhase >= rule.min_exchanges) {
        shouldAdvance = true;
        reason = `Minimum exchanges (${rule.min_exchanges}) met`;
      }
    }

    // Max exchanges check (force advance)
    if (rule?.max_exchanges && state.exchangeCountInPhase >= rule.max_exchanges) {
      shouldAdvance = true;
      reason = `Maximum exchanges (${rule.max_exchanges}) reached`;
    }

    if (shouldAdvance) {
      const nextPhase = getNextPhase(state.currentPhase);
      if (nextPhase) {
        this.advancePhase(state, nextPhase, reason);
        return {
          shouldTransition: true,
          newPhase: nextPhase,
          reason,
          confidence: 'high',
        };
      }
    }

    return {
      shouldTransition: false,
      newPhase: null,
      reason: 'Greeting phase: awaiting expected response',
      confidence: 'high',
    };
  }

  /**
   * Evaluate transition for interview phases (3-7)
   * Uses exchange counting + optional LLM coverage assessment
   */
  private async evaluateInterviewPhaseTransition(
    interviewId: string,
    state: InterviewPhaseState,
    candidateResponse: string,
    phaseConfig: ReturnType<PhasePromptBuilder['getPhaseConfig']>,
    context: PhaseManagerContext
  ): Promise<PhaseTransitionResult> {
    if (!phaseConfig) {
      return { shouldTransition: false, newPhase: null, reason: 'No config', confidence: 'high' };
    }

    const rule = this.phasePromptBuilder.getAdvancementRule(state.currentPhase);

    // Check time pressure
    const minutesRemaining = context.currentMinutesRemaining || 30;
    if (rule?.time_threshold_minutes && minutesRemaining <= rule.time_threshold_minutes) {
      const nextPhase = getNextPhase(state.currentPhase);
      if (nextPhase) {
        this.advancePhase(state, nextPhase, 'Time pressure - forcing advance');
        return {
          shouldTransition: true,
          newPhase: nextPhase,
          reason: `Time pressure: ${minutesRemaining} minutes remaining`,
          confidence: 'high',
        };
      }
    }

    // Check max exchanges (hard limit)
    if (rule?.max_exchanges && state.exchangeCountInPhase >= rule.max_exchanges) {
      const nextPhase = getNextPhase(state.currentPhase);
      if (nextPhase) {
        this.advancePhase(state, nextPhase, `Max exchanges (${rule.max_exchanges}) reached`);
        return {
          shouldTransition: true,
          newPhase: nextPhase,
          reason: `Maximum exchanges (${rule.max_exchanges}) reached`,
          confidence: 'high',
        };
      }
    }

    // Check min exchanges before considering coverage
    if (rule?.min_exchanges && state.exchangeCountInPhase < rule.min_exchanges) {
      return {
        shouldTransition: false,
        newPhase: null,
        reason: `Below minimum exchanges (${rule.min_exchanges})`,
        confidence: 'high',
      };
    }

    // For auto-advance phases with exchange-based rules
    if (phaseConfig.auto_advance && phaseConfig.advance_after_exchanges) {
      if (state.exchangeCountInPhase >= phaseConfig.advance_after_exchanges) {
        const nextPhase = getNextPhase(state.currentPhase);
        if (nextPhase) {
          this.advancePhase(state, nextPhase, `Auto-advance after ${phaseConfig.advance_after_exchanges} exchanges`);
          return {
            shouldTransition: true,
            newPhase: nextPhase,
            reason: `Exchange count threshold reached`,
            confidence: 'medium',
          };
        }
      }
    }

    // LLM-based coverage assessment (for more sophisticated transitions)
    if (rule?.llm_prompt && this.shouldUseLLMAssessment(state, rule)) {
      const coverageSufficient = await this.assessCoverageWithLLM(
        interviewId,
        state,
        candidateResponse,
        rule.llm_prompt
      );

      if (coverageSufficient) {
        const nextPhase = getNextPhase(state.currentPhase);
        if (nextPhase) {
          this.advancePhase(state, nextPhase, 'LLM coverage assessment passed');
          return {
            shouldTransition: true,
            newPhase: nextPhase,
            reason: 'Phase coverage sufficient (LLM assessed)',
            confidence: 'medium',
          };
        }
      }
    }

    return {
      shouldTransition: false,
      newPhase: null,
      reason: 'Interview phase: continue coverage',
      confidence: 'medium',
    };
  }

  /**
   * Evaluate transition for closing phases (8-9)
   */
  private evaluateClosingPhaseTransition(
    state: InterviewPhaseState,
    phaseConfig: ReturnType<PhasePromptBuilder['getPhaseConfig']>
  ): PhaseTransitionResult {
    if (!phaseConfig) {
      return { shouldTransition: false, newPhase: null, reason: 'No config', confidence: 'high' };
    }

    const rule = this.phasePromptBuilder.getAdvancementRule(state.currentPhase);

    // Candidate questions phase (8)
    if (state.currentPhase === 'phase_8_candidate_questions') {
      // Check for no-questions patterns
      if (rule?.patterns_no_questions) {
        // We need to look at the last user response
        // This is handled in processCandidateResponse
      }

      // Max exchanges
      if (rule?.max_exchanges && state.exchangeCountInPhase >= rule.max_exchanges) {
        this.advancePhase(state, 'phase_9_closing', 'Max question exchanges reached');
        return {
          shouldTransition: true,
          newPhase: 'phase_9_closing',
          reason: 'Sufficient question exchanges',
          confidence: 'high',
        };
      }

      // Min exchanges met
      if (rule?.min_exchanges && state.exchangeCountInPhase >= rule.min_exchanges) {
        // Allow staying for more questions or moving on
        // Don't auto-advance, let the interviewer decide based on flow
      }
    }

    // Closing phase (9) - never transitions, it's final
    if (state.currentPhase === 'phase_9_closing') {
      return {
        shouldTransition: false,
        newPhase: null,
        reason: 'Final phase - interview complete',
        confidence: 'high',
      };
    }

    return {
      shouldTransition: false,
      newPhase: null,
      reason: 'Closing phase: candidate questions ongoing',
      confidence: 'high',
    };
  }

  /**
   * Handle detected edge case
   */
  private handleEdgeCase(
    _interviewId: string,
    state: InterviewPhaseState,
    edgeCaseKey: string,
    _candidateResponse: string
  ): PhaseTransitionResult {
    const handler = this.phasePromptBuilder.getEdgeCaseHandler(edgeCaseKey);

    if (!handler) {
      return {
        shouldTransition: false,
        newPhase: null,
        reason: `Unknown edge case: ${edgeCaseKey}`,
        confidence: 'high',
      };
    }

    console.log(`[InterviewPhaseManager] Edge case triggered: ${edgeCaseKey} in ${state.currentPhase}`);

    // Handle specific edge cases
    switch (edgeCaseKey) {
      case 'early_closing_request':
        if (handler.jump_to_phase) {
          this.advancePhase(state, handler.jump_to_phase, 'Candidate requested early closing');
          return {
            shouldTransition: true,
            newPhase: handler.jump_to_phase,
            reason: 'Candidate requested early closing',
            confidence: 'high',
            edgeCaseTriggered: edgeCaseKey,
          };
        }
        break;

      case 'audio_issues':
        if (handler.recovery_phase) {
          // Reset to audio check
          this.advancePhase(state, handler.recovery_phase, 'Audio issues detected');
          return {
            shouldTransition: true,
            newPhase: handler.recovery_phase,
            reason: 'Audio issues - restarting audio check',
            confidence: 'high',
            edgeCaseTriggered: edgeCaseKey,
          };
        }
        break;

      case 'off_topic_question':
        state.offTopicExchangeCount++;
        if (handler.max_off_topic_exchanges &&
            state.offTopicExchangeCount >= handler.max_off_topic_exchanges) {
          // Force advance after max off-topic exchanges
          const nextPhase = getNextPhase(state.currentPhase);
          if (nextPhase) {
            this.advancePhase(state, nextPhase, 'Max off-topic exchanges reached');
            return {
              shouldTransition: true,
              newPhase: nextPhase,
              reason: 'Too many off-topic exchanges',
              confidence: 'medium',
              edgeCaseTriggered: edgeCaseKey,
            };
          }
        }
        break;

      case 'vague_answer':
        if (!state.lastFollowUpSent) {
          state.lastFollowUpSent = true;
          // Don't transition - let the interviewer handle it
          return {
            shouldTransition: false,
            newPhase: null,
            reason: 'Vague answer - follow-up sent',
            confidence: 'high',
            edgeCaseTriggered: edgeCaseKey,
          };
        } else {
          // Already followed up once, advance
          state.lastFollowUpSent = false;
          const nextPhase = getNextPhase(state.currentPhase);
          if (nextPhase) {
            this.advancePhase(state, nextPhase, 'Follow-up complete, advancing');
            return {
              shouldTransition: true,
              newPhase: nextPhase,
              reason: 'Follow-up sent, moving on',
              confidence: 'medium',
              edgeCaseTriggered: edgeCaseKey,
            };
          }
        }
        break;
    }

    return {
      shouldTransition: false,
      newPhase: null,
      reason: `Edge case handled: ${edgeCaseKey}`,
      confidence: 'high',
      edgeCaseTriggered: edgeCaseKey,
    };
  }

  /**
   * Advance to next phase and update state
   */
  private advancePhase(
    state: InterviewPhaseState,
    newPhase: InterviewPhase,
    reason: string
  ): void {
    const now = Date.now();

    // Update history
    const currentHistoryEntry = state.phaseHistory[state.phaseHistory.length - 1];
    if (currentHistoryEntry) {
      currentHistoryEntry.exitedAt = new Date(now).toISOString();
    }

    // Update state
    state.previousPhase = state.currentPhase;
    state.currentPhase = newPhase;
    state.phaseEnterTimeMs = now;
    state.exchangeCountInPhase = 0;
    state.lastFollowUpSent = false;
    state.offTopicExchangeCount = 0;
    state.lastTransitionReason = reason;

    // Add to history
    state.phaseHistory.push({
      phase: newPhase,
      enteredAt: new Date(now).toISOString(),
      exchanges: 0,
    });

    // Mark greeting complete if leaving phase 2
    if (state.previousPhase === 'phase_2_session_overview') {
      state.greetingCompleted = true;
    }

    console.log(`[InterviewPhaseManager] Advanced: ${state.previousPhase} -> ${newPhase} (${reason})`);
  }

  /**
   * Determine if we should use LLM for coverage assessment
   */
  private shouldUseLLMAssessment(
    state: InterviewPhaseState,
    rule: ReturnType<PhasePromptBuilder['getAdvancementRule']>
  ): boolean {
    if (!rule) return false;

    // Only use LLM periodically to save tokens
    // Use on every 2nd exchange after min_exchanges
    if (rule.min_exchanges) {
      return state.exchangeCountInPhase >= rule.min_exchanges &&
             (state.exchangeCountInPhase - rule.min_exchanges) % 2 === 0;
    }

    return true;
  }

  /**
   * Use LLM to assess if phase coverage is sufficient
   */
  private async assessCoverageWithLLM(
    _interviewId: string,
    _state: InterviewPhaseState,
    candidateResponse: string,
    llmPrompt: string
  ): Promise<boolean> {
    try {
      // Build context for LLM assessment
      const now = new Date().toISOString();
      const messages = [
        {
          id: `assess-sys-${Date.now()}`,
          role: 'system' as const,
          content: 'You are a coverage assessor. Analyze if the interview phase has sufficient coverage. Reply ONLY with "advance" or "continue".',
          timestamp: now,
        },
        {
          id: `assess-user-${Date.now()}`,
          role: 'user' as const,
          content: `${llmPrompt}\n\nCandidate response: ${candidateResponse}`,
          timestamp: now,
        },
      ];

      const response = await this.lemonadeClient.sendMessage(messages, {
        maxTokens: 10,
        temperature: 0.1,
      });

      const result = response.trim().toLowerCase();
      return result.includes('advance');
    } catch (error) {
      console.error('[InterviewPhaseManager] LLM coverage assessment failed:', error);
      // Default to continue on error
      return false;
    }
  }

  /**
   * Handle no-response timeout
   * Called when candidate doesn't respond within expected time
   */
  handleNoResponseTimeout(interviewId: string): PhaseTransitionResult {
    const state = this.phaseStates.get(interviewId);
    if (!state) {
      return { shouldTransition: false, newPhase: null, reason: 'No state', confidence: 'high' };
    }

    state.noResponseAttempts++;

    const handler = this.phasePromptBuilder.getEdgeCaseHandler('no_response_timeout');
    if (!handler || !handler.actions) {
      // Default: advance anyway after 3 attempts
      if (state.noResponseAttempts >= 3) {
        const nextPhase = getNextPhase(state.currentPhase);
        if (nextPhase) {
          this.advancePhase(state, nextPhase, 'No response - forced advance after 3 attempts');
          return {
            shouldTransition: true,
            newPhase: nextPhase,
            reason: 'No response timeout - forced advance',
            confidence: 'low',
            edgeCaseTriggered: 'no_response_timeout',
          };
        }
      }
      return {
        shouldTransition: false,
        newPhase: null,
        reason: `No response timeout - attempt ${state.noResponseAttempts}`,
        confidence: 'high',
        edgeCaseTriggered: 'no_response_timeout',
      };
    }

    // Use configured actions
    const action = handler.actions.find(a => a.attempt === state.noResponseAttempts);
    if (action?.action === 'advance_anyway') {
      const nextPhase = getNextPhase(state.currentPhase);
      if (nextPhase) {
        this.advancePhase(state, nextPhase, 'No response - advancing anyway');
        return {
          shouldTransition: true,
          newPhase: nextPhase,
          reason: 'No response timeout - forced advance',
          confidence: 'low',
          edgeCaseTriggered: 'no_response_timeout',
        };
      }
    }

    return {
      shouldTransition: false,
      newPhase: null,
      reason: `No response timeout - attempt ${state.noResponseAttempts}`,
      confidence: 'high',
      edgeCaseTriggered: 'no_response_timeout',
    };
  }

  /**
   * Force transition to specific phase (for manual overrides)
   */
  forceTransition(interviewId: string, targetPhase: InterviewPhase, reason: string): boolean {
    const state = this.phaseStates.get(interviewId);
    if (!state) return false;

    this.advancePhase(state, targetPhase, `Forced: ${reason}`);
    return true;
  }

  /**
   * Get phase statistics for debugging/analysis
   */
  getPhaseStats(interviewId: string): {
    currentPhase: InterviewPhase;
    phaseNumber: number;
    exchangeInPhase: number;
    totalExchanges: number;
    phaseDurations: { phase: InterviewPhase; durationMs: number }[];
  } | null {
    const state = this.phaseStates.get(interviewId);
    if (!state) return null;

    const now = Date.now();
    const phaseDurations = state.phaseHistory.map((entry, index) => {
      const start = new Date(entry.enteredAt).getTime();
      const end = entry.exitedAt
        ? new Date(entry.exitedAt).getTime()
        : (index === state.phaseHistory.length - 1 ? now : start);
      return {
        phase: entry.phase,
        durationMs: end - start,
      };
    });

    return {
      currentPhase: state.currentPhase,
      phaseNumber: PHASE_NUMBERS[state.currentPhase],
      exchangeInPhase: state.exchangeCountInPhase,
      totalExchanges: state.totalExchangesInInterview,
      phaseDurations,
    };
  }

  /**
   * Clean up interview state
   */
  cleanupInterview(interviewId: string): void {
    this.phaseStates.delete(interviewId);

    // Clear any pending timeouts
    const timer = this.timeoutTimers.get(interviewId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(interviewId);
    }

    console.log(`[InterviewPhaseManager] Cleaned up interview ${interviewId}`);
  }

  /**
   * Check if interview is complete (in closing phase)
   */
  isInterviewComplete(interviewId: string): boolean {
    const state = this.phaseStates.get(interviewId);
    return state ? state.currentPhase === 'phase_9_closing' : false;
  }
}

/**
 * Context for phase manager operations
 */
export interface PhaseManagerContext {
  currentMinutesRemaining: number;
  totalMinutes: number;
  transcript?: Message[];
}

/**
 * Factory function for creating phase manager
 */
export function createInterviewPhaseManager(lemonadeClient: LemonadeClient): InterviewPhaseManager {
  return new InterviewPhaseManager(lemonadeClient);
}
