import { getDatabase } from '../db';
import { Interview } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class InterviewRepository {
  private get store() {
    return getDatabase().interviews;
  }

  async create(interview: Partial<Interview>): Promise<Interview> {
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

    return await this.store.create(newInterview);
  }

  async findById(id: string): Promise<Interview | null> {
    return await this.store.findById(id);
  }

  async findAll(): Promise<Interview[]> {
    const interviews = await this.store.findAll();
    
    // Sort by created_at descending (most recent first)
    return interviews.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async update(id: string, updates: Partial<Interview>): Promise<Interview | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updatedInterview = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    return await this.store.update(id, updatedInterview);
  }

  async delete(id: string): Promise<boolean> {
    return await this.store.delete(id);
  }

  async updateTranscript(id: string, transcript: any[]): Promise<void> {
    await this.update(id, {
      transcript,
      updatedAt: new Date().toISOString(),
    });
  }

  // Additional query methods for convenience
  
  async findByStatus(status: string): Promise<Interview[]> {
    return await this.store.findAll(i => i.status === status);
  }

  async findByCompany(company: string): Promise<Interview[]> {
    return await this.store.findAll(i => 
      i.company.toLowerCase().includes(company.toLowerCase())
    );
  }

  async findByJobId(jobId: string): Promise<Interview[]> {
    return await this.store.findAll(i => i.jobId === jobId);
  }
}
