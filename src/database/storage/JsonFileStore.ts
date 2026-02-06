/**
 * JSON File Store
 * 
 * Stores each entity as a separate JSON file with atomic writes.
 * Uses temporary files and rename for atomicity.
 */

import fs from 'fs/promises';
import path from 'path';
import { IDataStore } from './IDataStore';

export class JsonFileStore<T extends { id: string }> implements IDataStore<T> {
  private basePath: string;
  private collectionName: string;
  private initialized: boolean = false;

  constructor(basePath: string, collectionName: string) {
    this.basePath = basePath;
    this.collectionName = collectionName;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const collectionPath = this.getCollectionPath();
    
    try {
      await fs.mkdir(collectionPath, { recursive: true });
      this.initialized = true;
      console.log(`✓ Initialized JSON store: ${collectionPath}`);
    } catch (error) {
      console.error(`Failed to initialize JSON store for ${this.collectionName}:`, error);
      throw error;
    }
  }

  async create(entity: T): Promise<T> {
    await this.ensureInitialized();
    await this.saveEntity(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<T | null> {
    await this.ensureInitialized();
    
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error(`Failed to read entity ${id} from ${this.collectionName}:`, error);
      throw error;
    }
  }

  async findAll(filter?: (entity: T) => boolean): Promise<T[]> {
    await this.ensureInitialized();
    
    try {
      const collectionPath = this.getCollectionPath();
      const files = await fs.readdir(collectionPath);
      
      const entities: T[] = [];
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(collectionPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entity = JSON.parse(content) as T;
          
          if (!filter || filter(entity)) {
            entities.push(entity);
          }
        } catch (error) {
          console.warn(`Failed to read file ${file}:`, error);
          // Continue with other files
        }
      }
      
      return entities;
    } catch (error) {
      console.error(`Failed to read collection ${this.collectionName}:`, error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    await this.ensureInitialized();
    
    const existing = await this.findById(id);
    if (!existing) return null;
    
    const updated = {
      ...existing,
      ...updates,
      id, // Ensure ID cannot be changed
    };
    
    await this.saveEntity(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      console.error(`Failed to delete entity ${id} from ${this.collectionName}:`, error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const filePath = this.getFilePath(id);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async count(filter?: (entity: T) => boolean): Promise<number> {
    const entities = await this.findAll(filter);
    return entities.length;
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const collectionPath = this.getCollectionPath();
      const files = await fs.readdir(collectionPath);
      
      await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(f => fs.unlink(path.join(collectionPath, f)))
      );
      
      console.log(`✓ Cleared collection: ${this.collectionName}`);
    } catch (error) {
      console.error(`Failed to clear collection ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Atomic write using temporary file and rename
   */
  private async saveEntity(id: string, entity: T): Promise<void> {
    const filePath = this.getFilePath(id);
    const tempPath = `${filePath}.tmp`;
    
    try {
      // Write to temporary file
      const content = JSON.stringify(entity, null, 2);
      await fs.writeFile(tempPath, content, 'utf-8');
      
      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (_cleanupError) {
        // Ignore cleanup errors
      }
      
      console.error(`Failed to save entity ${id} to ${this.collectionName}:`, error);
      throw error;
    }
  }

  private getCollectionPath(): string {
    return path.join(this.basePath, this.collectionName);
  }

  private getFilePath(id: string): string {
    // Sanitize ID for filename (replace invalid chars)
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.getCollectionPath(), `${sanitizedId}.json`);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
