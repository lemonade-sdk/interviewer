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
    
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const getModelTypeColor = (type: string) => {
    switch (type) {
      case 'llm':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'audio':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'embedding':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'reranking':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'image':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getDeviceBadges = (device: string) => {
    return device.split(' ').map(d => d.trim().toUpperCase());
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Loaded Models</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Loaded Models</h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          <button
            onClick={loadHealth}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!health || !health.all_models_loaded || health.all_models_loaded.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Loaded Models</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No models currently loaded. Load a model from the Settings page.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Loaded Models</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
        </div>
      </div>

      {/* Model Capacity */}
      {health.max_models && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-xs font-medium text-blue-800 dark:text-blue-400 mb-2">
            Model Capacity
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(health.max_models).map(([type, max]) => (
              <div key={type} className="flex items-center space-x-1">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {type.toUpperCase()}:
                </span>
                <span className="text-blue-800 dark:text-blue-300">
                  {health.all_models_loaded.filter((m: LoadedModel) => m.type === type).length} / {max}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio model limit warning */}
      {health.max_models && (health.max_models.audio ?? 1) < 2 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">
            Audio Model Limit Too Low
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Both Whisper (ASR) and Kokoro (TTS) need to be loaded simultaneously.
            Restart Lemonade Server with:
          </p>
          <code className="block mt-1 text-xs font-mono bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded text-amber-900 dark:text-amber-200">
            lemonade-server serve --max-loaded-models 2
          </code>
        </div>
      )}

      {/* Loaded Models List */}
      <div className="space-y-3">
        {health.all_models_loaded.map((model: LoadedModel, index: number) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {model.model_name}
                </div>
                {model.backend && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Backend: {model.backend}
                  </div>
                )}
              </div>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getModelTypeColor(model.type)}`}>
                {model.type.toUpperCase()}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {getDeviceBadges(model.device).map((device, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono"
                >
                  {device}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Updates automatically every 5 seconds
      </div>
    </div>
  );
};
