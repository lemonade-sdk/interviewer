/**
 * Database Module
 * 
 * This module provides the main database interface for the application.
 * Migrated from SQLite to JSON file storage for zero-dependency installation.
 */

import { StorageManager, getStorageManager } from './storage/StorageManager';

let storageManager: StorageManager | null = null;

/**
 * Initialize the database/storage system
 */
export async function initializeDatabase(): Promise<StorageManager> {
  if (storageManager) return storageManager;

  console.log('Initializing database...');
  
  storageManager = getStorageManager();
  await storageManager.initialize();
  
  const stats = await storageManager.getStats();
  console.log('Database initialized successfully');
  console.log('Storage statistics:', stats);
  
  return storageManager;
}

/**
 * Get the storage manager instance
 * @throws Error if not initialized
 */
export function getDatabase(): StorageManager {
  if (!storageManager) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return storageManager;
}

/**
 * Close/cleanup the database
 */
export function closeDatabase(): void {
  if (storageManager) {
    console.log('Closing database...');
    // JSON storage doesn't need explicit closing, but we reset the instance
    storageManager = null;
    console.log('Database closed');
  }
}

/**
 * Export storage manager type for use in repositories
 */
export type { StorageManager };
