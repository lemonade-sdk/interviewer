import React, { useEffect, useState } from 'react';
import { SystemInfo } from '../../types';

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
      <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-4">System Information</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-lemonade-accent/30 border-t-lemonade-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-4">System Information</h3>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/15 rounded-xl p-6">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button onClick={loadSystemInfo} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!systemInfo) {
    return (
      <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-4">System Information</h3>
        <p className="text-gray-500 dark:text-white/40 text-sm">
          System information not available. Make sure Lemonade Server is running.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">System Information</h3>
        <button
          onClick={loadSystemInfo}
          className="text-xs font-medium text-lemonade-accent-hover hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {/* Hardware Info */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
            Hardware
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Processor:</span>
              <span className="font-mono text-xs">{systemInfo.processor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-white/40">Memory:</span>
              <span className="font-mono text-xs">{systemInfo.physicalMemory}</span>
            </div>
          </div>
        </div>

        {/* Devices */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
            Available Devices
          </h4>
          <div className="space-y-2">
            {systemInfo.devices.cpu && (
              <div className="flex items-center justify-between bg-lemonade-bg dark:bg-white/[0.03] rounded-xl px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${systemInfo.devices.cpu.available ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">CPU</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-white/40">{systemInfo.devices.cpu.cores} cores</span>
              </div>
            )}
            {systemInfo.devices.amd_igpu && (
              <div className="flex items-center justify-between bg-lemonade-bg dark:bg-white/[0.03] rounded-xl px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${systemInfo.devices.amd_igpu.available !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">AMD iGPU</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-white/40">{systemInfo.devices.amd_igpu.vram_gb} GB VRAM</span>
              </div>
            )}
            {systemInfo.devices.nvidia_dgpu && (
              <div className="flex items-center justify-between bg-lemonade-bg dark:bg-white/[0.03] rounded-xl px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${systemInfo.devices.nvidia_dgpu.available !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">NVIDIA GPU</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-white/40">{systemInfo.devices.nvidia_dgpu.vram_gb} GB VRAM</span>
              </div>
            )}
            {systemInfo.devices.npu && (
              <div className="flex items-center justify-between bg-lemonade-bg dark:bg-white/[0.03] rounded-xl px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${systemInfo.devices.npu.available ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">NPU</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-white/40">AI Accelerator</span>
              </div>
            )}
          </div>
        </div>

        {/* Backends */}
        {systemInfo.recipes && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
              Available Backends
            </h4>
            <div className="space-y-2">
              {systemInfo.recipes.llamacpp && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-white/40 mb-1">
                    LLM (llama.cpp)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(systemInfo.recipes.llamacpp.backends).map(([name, config]) => (
                      <span
                        key={name}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          config.available
                            ? 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-white/30'
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
                  <div className="text-xs font-medium text-gray-500 dark:text-white/40 mb-1">
                    ASR (whisper.cpp)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(systemInfo.recipes.whispercpp.backends).map(([name, config]) => (
                      <span
                        key={name}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          config.available
                            ? 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-white/30'
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
