/**
 * In-Memory Cache Store
 * 
 * Wraps another data store with in-memory caching for improved performance.
 * Implements write-through caching strategy.
 */

import { IDataStore } from './IDataStore';

export class CachedStore<T extends { id: string }> implements IDataStore<T> {
  private cache: Map<string, T> = new Map();
  private loaded: boolean = false;
  private backend: IDataStore<T>;

  constructor(backend: IDataStore<T>) {
    this.backend = backend;
  }

  async initialize(): Promise<void> {
    await this.backend.initialize();
    await this.loadCache();
  }

  async create(entity: T): Promise<T> {
    const created = await this.backend.create(entity);
    this.cache.set(created.id, created);
    return created;
  }

  async findById(id: string): Promise<T | null> {
    await this.ensureLoaded();
    return this.cache.get(id) || null;
  }

  async findAll(filter?: (entity: T) => boolean): Promise<T[]> {
    await this.ensureLoaded();
    
    const entities = Array.from(this.cache.values());
    
    if (filter) {
      return entities.filter(filter);
    }
    
    return entities;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const updated = await this.backend.update(id, updates);
    
    if (updated) {
      this.cache.set(id, updated);
    }
    
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.backend.delete(id);
    
    if (deleted) {
      this.cache.delete(id);
    }
    
    return deleted;
  }

  async exists(id: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.cache.has(id);
  }

  async count(filter?: (entity: T) => boolean): Promise<number> {
    const entities = await this.findAll(filter);
    return entities.length;
  }

  async clear(): Promise<void> {
    await this.backend.clear();
    this.cache.clear();
  }

  /**
   * Reload cache from backend
   */
  async refresh(): Promise<void> {
    await this.loadCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; loaded: boolean } {
    return {
      size: this.cache.size,
      loaded: this.loaded,
    };
  }

  private async loadCache(): Promise<void> {
    try {
      const entities = await this.backend.findAll();
      
      this.cache.clear();
      for (const entity of entities) {
        this.cache.set(entity.id, entity);
      }
      
      this.loaded = true;
      console.log(`✓ Loaded ${this.cache.size} entities into cache`);
    } catch (error) {
      console.error('Failed to load cache:', error);
      throw error;
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.loadCache();
    }
  }
}
