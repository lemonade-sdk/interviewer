/**
 * PipelineLogger — writes one NDJSON log file per interview session.
 *
 * Each line is a self-contained JSON object describing one step in the AI
 * pipeline (persona gen, job extraction, greeting, interview turn, feedback).
 *
 * Initialize from main.ts BEFORE any service calls:
 *   PipelineLogger.init(app.getPath('userData'));
 *
 * Then anywhere in the main process:
 *   PipelineLogger.getInstance().log(sessionId, entry);
 */

import fs from 'fs';
import path from 'path';

export type PipelineStage =
  | 'job-extraction-stage1'
  | 'job-extraction-stage2'
  | 'persona-generation'
  | 'interview-greeting'
  | 'interview-turn'
  | 'interview-feedback'
  | 'interview-feedback-grading';

export interface PipelineEntry {
  stage: PipelineStage;
  model: string;
  /** Total character count of all input messages combined */
  inputChars: number;
  /** Approximate token count (chars / 4) */
  inputTokensEst: number;
  maxOutputTokens: number;
  /** Number of messages sent to the LLM */
  messageCount: number;
  systemChars?: number;
  userChars?: number;
  finishReason: string;
  outputChars: number;
  /** First 600 chars of the response for quick inspection */
  outputPreview: string;
  /** Key extracted values (persona name, company, score, …) */
  extracted?: Record<string, string | number | boolean | null>;
  meta?: Record<string, unknown>;
  durationMs: number;
  timestamp: string;
}

export class PipelineLogger {
  private static instance: PipelineLogger | null = null;
  private logDir: string;

  private constructor(logDir: string) {
    this.logDir = path.join(logDir, 'pipeline-logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    console.log(`[PipelineLogger] Writing session logs to: ${this.logDir}`);
  }

  /** Call once from main.ts with app.getPath('userData'). */
  static init(userDataPath: string): void {
    if (!PipelineLogger.instance) {
      PipelineLogger.instance = new PipelineLogger(userDataPath);
    }
  }

  static getInstance(): PipelineLogger {
    if (!PipelineLogger.instance) {
      throw new Error('PipelineLogger.init() must be called before getInstance()');
    }
    return PipelineLogger.instance;
  }

  /** Append one JSON line to the session log file. Non-fatal on error. */
  log(sessionId: string, entry: PipelineEntry): void {
    try {
      const filename = path.join(this.logDir, `session-${sessionId}.jsonl`);
      const line = JSON.stringify({ sessionId, ...entry }) + '\n';
      fs.appendFileSync(filename, line, 'utf8');
    } catch (err) {
      console.warn('[PipelineLogger] Failed to write entry:', err);
    }
  }

  getLogDir(): string {
    return this.logDir;
  }

  /** List all session log files, newest first. */
  listLogs(): string[] {
    try {
      return fs
        .readdirSync(this.logDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => path.join(this.logDir, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    } catch {
      return [];
    }
  }
}
