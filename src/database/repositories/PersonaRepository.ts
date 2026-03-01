import { getDatabase } from '../db';
import { AgentPersona } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class PersonaRepository {
  private get store() {
    return getDatabase().personas;
  }

  async create(persona: Partial<AgentPersona>): Promise<AgentPersona> {
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
      // v5: Interview intelligence fields - critical for structured interview arc
      personaRole: persona.personaRole,
      q1Topic: persona.q1Topic,
      q2Topic: persona.q2Topic,
      q3Topic: persona.q3Topic,
      q4Topic: persona.q4Topic,
      q5Topic: persona.q5Topic,
      primaryProbeArea: persona.primaryProbeArea,
      mustCoverTopic1: persona.mustCoverTopic1,
      mustCoverTopic2: persona.mustCoverTopic2,
      mustCoverTopic3: persona.mustCoverTopic3,
      validateClaim1: persona.validateClaim1,
      validateClaim2: persona.validateClaim2,
      watchSignal1: persona.watchSignal1,
      watchSignal2: persona.watchSignal2,
    };

    return await this.store.create(newPersona);
  }

  async findById(id: string): Promise<AgentPersona | null> {
    return await this.store.findById(id);
  }

  async findAll(): Promise<AgentPersona[]> {
    const personas = await this.store.findAll();
    
    // Sort by default first, then alphabetically by name
    return personas.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async findDefault(): Promise<AgentPersona | null> {
    const defaults = await this.store.findAll(p => p.isDefault);
    return defaults.length > 0 ? defaults[0] : null;
  }

  async update(id: string, updates: Partial<AgentPersona>): Promise<AgentPersona | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updatedPersona = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    return await this.store.update(id, updatedPersona);
  }

  async delete(id: string): Promise<boolean> {
    // Don't allow deleting default personas
    const persona = await this.findById(id);
    if (persona?.isDefault) {
      throw new Error('Cannot delete default persona');
    }

    return await this.store.delete(id);
  }

  async setDefault(id: string): Promise<boolean> {
    // First, unset all defaults
    const allPersonas = await this.findAll();
    
    for (const persona of allPersonas) {
      if (persona.isDefault) {
        await this.update(persona.id, { isDefault: false });
      }
    }

    // Then set the new default
    const result = await this.update(id, { isDefault: true });
    return result !== null;
  }
}
