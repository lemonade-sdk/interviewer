/**
 * Generic Data Store Interface
 * 
 * Provides abstraction over storage backends (JSON files, SQLite, IndexedDB, etc.)
 * Supports CRUD operations with optional filtering and caching
 */

export interface IDataStore<T extends { id: string }> {
  /**
   * Initialize the storage (create directories, load cache, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Create a new entity
   */
  create(entity: T): Promise<T>;

  /**
   * Find entity by ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find all entities, optionally filtered
   */
  findAll(filter?: (entity: T) => boolean): Promise<T[]>;

  /**
   * Update an existing entity
   */
  update(id: string, updates: Partial<T>): Promise<T | null>;

  /**
   * Delete an entity by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if entity exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get count of entities
   */
  count(filter?: (entity: T) => boolean): Promise<number>;

  /**
   * Clear all entities (use with caution)
   */
  clear(): Promise<void>;
}
