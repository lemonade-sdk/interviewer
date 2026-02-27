import React, { useEffect, useState } from 'react';
import { ServerHealth, LoadedModel } from '../../types';

export const MultiModelStatus: React.FC = () => {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    try {
      setError(null);
      const healthData = await window.electronAPI.getServerHealth();
      setHealth(healthData);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load server health');
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const getModelTypeColor = (type: string) => {
    switch (type) {
      case 'llm': return 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-400';
      case 'audio': return 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-400';
      case 'embedding': return 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-400';
      case 'reranking': return 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-400';
      case 'image': return 'bg-pink-100 dark:bg-pink-500/15 text-pink-800 dark:text-pink-400';
      default: return 'bg-gray-100 dark:bg-white/[0.04] text-gray-800 dark:text-white/50';
    }
  };

  const getDeviceBadges = (device: string) => {
    return device.split(' ').map(d => d.trim().toUpperCase());
  };

  if (loading) {
    return (
      <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-4">Loaded Models</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-lemonade-accent/30 border-t-lemonade-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-4">Loaded Models</h3>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/15 rounded-xl p-4">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button onClick={loadHealth} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!health || !health.all_models_loaded || health.all_models_loaded.length === 0) {
    return (
      <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">Loaded Models</h3>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
            <span className="text-[11px] text-gray-500 dark:text-white/40">Live</span>
          </div>
        </div>
        <p className="text-gray-500 dark:text-white/40 text-sm">
          No models currently loaded. Load a model from the Settings page.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">Loaded Models</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] text-gray-500 dark:text-white/40">Live</span>
        </div>
      </div>

      {/* Model Capacity */}
      {health.max_models && (
        <div className="mb-4 p-6 bg-lemonade-accent/[0.04] border border-lemonade-accent/15 rounded-xl">
          <div className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
            Model Capacity
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(health.max_models).map(([type, max]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="text-lemonade-accent-hover font-medium">{type.toUpperCase()}:</span>
                <span>{health.all_models_loaded.filter((m: LoadedModel) => m.type === type).length} / {max}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio model limit warning */}
      {health.max_models && (health.max_models.audio ?? 1) < 2 && (
        <div className="mb-4 p-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/15 rounded-xl">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">
            Audio Model Limit Too Low
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Both Whisper (ASR) and Kokoro (TTS) need to be loaded simultaneously.
            Restart Lemonade Server with:
          </p>
          <code className="block mt-1 text-xs font-mono bg-amber-100 dark:bg-amber-500/15 px-3 py-2 rounded-xl text-amber-900 dark:text-amber-200">
            lemonade-server serve --max-loaded-models 2
          </code>
        </div>
      )}

      {/* Loaded Models List */}
      <div className="space-y-2">
        {health.all_models_loaded.map((model: LoadedModel, index: number) => (
          <div
            key={index}
            className="border border-gray-200/50 dark:border-white/[0.08] rounded-xl p-6 hover:border-lemonade-accent/40 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{model.model_name}</div>
                {model.backend && (
                  <div className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">Backend: {model.backend}</div>
                )}
              </div>
              <span className={`ml-2 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${getModelTypeColor(model.type)}`}>
                {model.type.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {getDeviceBadges(model.device).map((device, idx) => (
                <span key={idx} className="px-2.5 py-1 bg-gray-100 dark:bg-white/[0.04] text-gray-700 dark:text-white/50 rounded-full text-[11px] font-mono">
                  {device}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-[11px] text-gray-400 dark:text-white/30 text-center">
        Updates automatically every 5 seconds
      </div>
    </div>
  );
};
