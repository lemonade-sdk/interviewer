import { getDatabase } from '../db';
import { Job } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class JobRepository {
  private db = getDatabase();

  create(job: Partial<Job>): Job {
    const now = new Date().toISOString();
    const newJob: Job = {
      id: uuidv4(),
      title: job.title || 'Untitled Job',
      company: job.company || '',
      description: job.description,
      status: job.status || 'interested',
      appliedAt: job.appliedAt,
      interviewIds: [],
      notes: job.notes,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, title, company, description, status, applied_at,
        interview_ids, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newJob.id,
      newJob.title,
      newJob.company,
      newJob.description || null,
      newJob.status,
      newJob.appliedAt || null,
      JSON.stringify(newJob.interviewIds),
      newJob.notes || null,
      newJob.createdAt,
      newJob.updatedAt
    );

    return newJob;
  }

  findById(id: string): Job | null {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapRowToJob(row);
  }

  findAll(): Job[] {
    const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => this.mapRowToJob(row));
  }

  update(id: string, updates: Partial<Job>): Job | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE jobs SET
        title = ?,
        company = ?,
        description = ?,
        status = ?,
        applied_at = ?,
        interview_ids = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedJob.title,
      updatedJob.company,
      updatedJob.description || null,
      updatedJob.status,
      updatedJob.appliedAt || null,
      JSON.stringify(updatedJob.interviewIds),
      updatedJob.notes || null,
      updatedJob.updatedAt,
      id
    );

    return updatedJob;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM jobs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      title: row.title,
      company: row.company,
      description: row.description,
      status: row.status,
      appliedAt: row.applied_at,
      interviewIds: JSON.parse(row.interview_ids),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
