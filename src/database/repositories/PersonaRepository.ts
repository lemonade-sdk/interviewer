import { getDatabase } from '../db';
import { AgentPersona } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class PersonaRepository {
  private db = getDatabase();

  create(persona: Partial<AgentPersona>): AgentPersona {
    const now = new Date().toISOString();
    const newPersona: AgentPersona = {
      id: uuidv4(),
      name: persona.name || 'Untitled Persona',
      description: persona.description || '',
      systemPrompt: persona.systemPrompt || '',
      interviewStyle: persona.interviewStyle || 'conversational',
      questionDifficulty: persona.questionDifficulty || 'medium',
      ttsVoice: persona.ttsVoice,
      avatarUrl: persona.avatarUrl,
      isDefault: persona.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO agent_personas (
        id, name, description, system_prompt, interview_style,
        question_difficulty, tts_voice, avatar_url, is_default,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newPersona.id,
      newPersona.name,
      newPersona.description,
      newPersona.systemPrompt,
      newPersona.interviewStyle,
      newPersona.questionDifficulty,
      newPersona.ttsVoice || null,
      newPersona.avatarUrl || null,
      newPersona.isDefault ? 1 : 0,
      newPersona.createdAt,
      newPersona.updatedAt
    );

    return newPersona;
  }

  findById(id: string): AgentPersona | null {
    const stmt = this.db.prepare('SELECT * FROM agent_personas WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapRowToPersona(row);
  }

  findAll(): AgentPersona[] {
    const stmt = this.db.prepare('SELECT * FROM agent_personas ORDER BY is_default DESC, name ASC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => this.mapRowToPersona(row));
  }

  findDefault(): AgentPersona | null {
    const stmt = this.db.prepare('SELECT * FROM agent_personas WHERE is_default = 1 LIMIT 1');
    const row = stmt.get() as any;
    
    if (!row) return null;
    
    return this.mapRowToPersona(row);
  }

  update(id: string, updates: Partial<AgentPersona>): AgentPersona | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updatedPersona = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE agent_personas SET
        name = ?,
        description = ?,
        system_prompt = ?,
        interview_style = ?,
        question_difficulty = ?,
        tts_voice = ?,
        avatar_url = ?,
        is_default = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedPersona.name,
      updatedPersona.description,
      updatedPersona.systemPrompt,
      updatedPersona.interviewStyle,
      updatedPersona.questionDifficulty,
      updatedPersona.ttsVoice || null,
      updatedPersona.avatarUrl || null,
      updatedPersona.isDefault ? 1 : 0,
      updatedPersona.updatedAt,
      id
    );

    return updatedPersona;
  }

  delete(id: string): boolean {
    // Don't allow deleting default personas
    const persona = this.findById(id);
    if (persona?.isDefault) {
      throw new Error('Cannot delete default persona');
    }

    const stmt = this.db.prepare('DELETE FROM agent_personas WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  setDefault(id: string): boolean {
    // First, unset all defaults
    const unsetStmt = this.db.prepare('UPDATE agent_personas SET is_default = 0');
    unsetStmt.run();

    // Then set the new default
    const setStmt = this.db.prepare('UPDATE agent_personas SET is_default = 1 WHERE id = ?');
    const result = setStmt.run(id);
    return result.changes > 0;
  }

  private mapRowToPersona(row: any): AgentPersona {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      interviewStyle: row.interview_style,
      questionDifficulty: row.question_difficulty,
      ttsVoice: row.tts_voice,
      avatarUrl: row.avatar_url,
      isDefault: row.is_default === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
