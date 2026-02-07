import { getDatabase } from '../db';
import { UploadedDocument } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class DocumentRepository {
  private get store() {
    return getDatabase().documents;
  }

  async create(doc: Omit<UploadedDocument, 'id' | 'uploadedAt'>): Promise<UploadedDocument> {
    const newDoc: UploadedDocument = {
      id: uuidv4(),
      ...doc,
      uploadedAt: new Date().toISOString(),
    };

    return await this.store.create(newDoc);
  }

  async findById(id: string): Promise<UploadedDocument | null> {
    return await this.store.findById(id);
  }

  async findAll(): Promise<UploadedDocument[]> {
    const docs = await this.store.findAll();
    return docs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async findByType(type: 'resume' | 'job_post'): Promise<UploadedDocument[]> {
    return await this.store.findAll(d => d.type === type);
  }

  async getLatestByType(type: 'resume' | 'job_post'): Promise<UploadedDocument | null> {
    const docs = await this.findByType(type);
    return docs.length > 0 ? docs[0] : null;
  }

  async delete(id: string): Promise<boolean> {
    return await this.store.delete(id);
  }
}
