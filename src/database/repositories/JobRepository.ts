import { getDatabase } from '../db';
import { Job } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class JobRepository {
  private get store() {
    return getDatabase().jobs;
  }

  async create(job: Partial<Job>): Promise<Job> {
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

    return await this.store.create(newJob);
  }

  async findById(id: string): Promise<Job | null> {
    return await this.store.findById(id);
  }

  async findAll(): Promise<Job[]> {
    const jobs = await this.store.findAll();
    
    // Sort by created_at descending (most recent first)
    return jobs.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async update(id: string, updates: Partial<Job>): Promise<Job | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updatedJob = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    return await this.store.update(id, updatedJob);
  }

  async delete(id: string): Promise<boolean> {
    return await this.store.delete(id);
  }

  // Additional query methods for convenience
  
  async findByStatus(status: string): Promise<Job[]> {
    return await this.store.findAll(j => j.status === status);
  }

  async findByCompany(company: string): Promise<Job[]> {
    return await this.store.findAll(j => 
      j.company.toLowerCase().includes(company.toLowerCase())
    );
  }
}
