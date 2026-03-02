import React, { useEffect, useState } from 'react';
import { User, Star, TrendingUp, Zap } from 'lucide-react';
import { AgentPersona } from '../../types';

interface Props {
  selectedPersonaId?: string;
  onSelect: (persona: AgentPersona) => void;
  onClose?: () => void;
}

const difficultyIcons = {
  easy: '😊',
  medium: '🎯',
  hard: '🔥',
};

const styleIcons = {
  conversational: <User size={20} />,
  challenging: <TrendingUp size={20} />,
  supportive: <Star size={20} />,
  technical: <Zap size={20} />,
};

export const PersonaSelector: React.FC<Props> = ({ 
  selectedPersonaId, 
  onSelect,
  onClose 
}) => {
  const [personas, setPersonas] = useState<AgentPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      setError(null);
      const allPersonas = await window.electronAPI.getAllPersonas();
      setPersonas(allPersonas);
    } catch (err) {
      console.error('Failed to load personas:', err);
      setError('Failed to load interviewer personas');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (persona: AgentPersona) => {
    onSelect(persona);
    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadPersonas}
          className="mt-2 text-sm text-red-700 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          Select Your Interviewer
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => (
          <div
            key={persona.id}
            onClick={() => handleSelect(persona)}
            className={`p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
              selectedPersonaId === persona.id
                ? 'border-primary-600 bg-primary-50 shadow-md'
                : 'border-gray-200 hover:border-primary-300 bg-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900">
                  {persona.name}
                </h3>
                {persona.isDefault && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary-600 font-medium">
                    <Star size={12} fill="currentColor" />
                    Default
                  </span>
                )}
              </div>
              <div className="text-gray-400">
                {styleIcons[persona.interviewStyle as keyof typeof styleIcons] || <User size={20} />}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {persona.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                {persona.interviewStyle}
              </span>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium flex items-center gap-1.5">
                <span>{difficultyIcons[persona.questionDifficulty as keyof typeof difficultyIcons] || '📝'}</span>
                {persona.questionDifficulty}
              </span>
            </div>

            {/* System Prompt Preview */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 line-clamp-2 italic">
                &quot;{persona.systemPrompt}&quot;
              </p>
            </div>
          </div>
        ))}
      </div>

      {personas.length === 0 && (
        <div className="text-center p-8 text-gray-500">
          <User size={48} className="mx-auto mb-2 opacity-50" />
          <p>No interviewer personas available</p>
          <p className="text-sm mt-1">
            Default personas will be created on first launch
          </p>
        </div>
      )}
    </div>
  );
};
