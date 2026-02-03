import { getDatabase } from '../db';
import { Interview } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class InterviewRepository {
  private db = getDatabase();

  create(interview: Partial<Interview>): Interview {
    const now = new Date().toISOString();
    const newInterview: Interview = {
      id: uuidv4(),
      title: interview.title || 'Untitled Interview',
      company: interview.company || '',
      position: interview.position || '',
      interviewType: interview.interviewType || 'general',
      status: 'in-progress',
      startedAt: now,
      transcript: [],
      createdAt: now,
      updatedAt: now,
      jobId: interview.jobId,
    };

    const stmt = this.db.prepare(`
      INSERT INTO interviews (
        id, job_id, title, company, position, interview_type,
        status, started_at, transcript, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newInterview.id,
      newInterview.jobId || null,
      newInterview.title,
      newInterview.company,
      newInterview.position,
      newInterview.interviewType,
      newInterview.status,
      newInterview.startedAt,
      JSON.stringify(newInterview.transcript),
      newInterview.createdAt,
      newInterview.updatedAt
    );

    return newInterview;
  }

  findById(id: string): Interview | null {
    const stmt = this.db.prepare('SELECT * FROM interviews WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapRowToInterview(row);
  }

  findAll(): Interview[] {
    const stmt = this.db.prepare('SELECT * FROM interviews ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => this.mapRowToInterview(row));
  }

  update(id: string, updates: Partial<Interview>): Interview | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedInterview = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE interviews SET
        job_id = ?,
        title = ?,
        company = ?,
        position = ?,
        interview_type = ?,
        status = ?,
        ended_at = ?,
        duration = ?,
        transcript = ?,
        feedback = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedInterview.jobId || null,
      updatedInterview.title,
      updatedInterview.company,
      updatedInterview.position,
      updatedInterview.interviewType,
      updatedInterview.status,
      updatedInterview.endedAt || null,
      updatedInterview.duration || null,
      JSON.stringify(updatedInterview.transcript),
      updatedInterview.feedback ? JSON.stringify(updatedInterview.feedback) : null,
      updatedInterview.updatedAt,
      id
    );

    return updatedInterview;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM interviews WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRowToInterview(row: any): Interview {
    return {
      id: row.id,
      jobId: row.job_id,
      title: row.title,
      company: row.company,
      position: row.position,
      interviewType: row.interview_type,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      duration: row.duration,
      transcript: JSON.parse(row.transcript),
      feedback: row.feedback ? JSON.parse(row.feedback) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
