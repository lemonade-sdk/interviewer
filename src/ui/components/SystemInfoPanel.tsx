import React, { useEffect, useState } from 'react';
import { SystemInfo } from '../../types';

declare global {
  interface Window {
    electronAPI: {
      getSystemInfo: () => Promise<SystemInfo | null>;
    };
  }
}

export const SystemInfoPanel: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await window.electronAPI.getSystemInfo();
      setSystemInfo(info);
    } catch (err: any) {
      setError(err.message || 'Failed to load system information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          <button
            onClick={loadSystemInfo}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!systemInfo) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          System information not available. Make sure Lemonade Server is running.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">System Information</h3>
        <button
          onClick={loadSystemInfo}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {/* Hardware Info */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Hardware
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Processor:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {systemInfo.processor}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Memory:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {systemInfo.physicalMemory}
              </span>
            </div>
          </div>
        </div>

        {/* Devices */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Available Devices
          </h4>
          <div className="space-y-2">
            {systemInfo.devices.cpu && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemInfo.devices.cpu.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">CPU</span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {systemInfo.devices.cpu.cores} cores
                </span>
              </div>
            )}

            {systemInfo.devices.amd_igpu && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemInfo.devices.amd_igpu.available !== false ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">AMD iGPU</span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {systemInfo.devices.amd_igpu.vram_gb} GB VRAM
                </span>
              </div>
            )}

            {systemInfo.devices.nvidia_dgpu && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemInfo.devices.nvidia_dgpu.available !== false ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">NVIDIA GPU</span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {systemInfo.devices.nvidia_dgpu.vram_gb} GB VRAM
                </span>
              </div>
            )}

            {systemInfo.devices.npu && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemInfo.devices.npu.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">NPU</span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  AI Accelerator
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Backends */}
        {systemInfo.recipes && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Available Backends
            </h4>
            <div className="space-y-2">
              {systemInfo.recipes.llamacpp && (
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    LLM (llama.cpp)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(systemInfo.recipes.llamacpp.backends).map(([name, config]) => (
                      <span
                        key={name}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          config.available
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {systemInfo.recipes.whispercpp && (
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    ASR (whisper.cpp)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(systemInfo.recipes.whispercpp.backends).map(([name, config]) => (
                      <span
                        key={name}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          config.available
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
