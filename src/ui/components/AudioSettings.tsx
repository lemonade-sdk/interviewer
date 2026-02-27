import React, { useEffect, useState } from 'react';
import { Mic, Speaker, Volume2, Settings, RefreshCw } from 'lucide-react';
import { AudioDevice } from '../../types';
import { LemonSelect } from './lemon/LemonSelect';
import { LemonSlider } from './lemon/LemonSlider';

interface Props {
  onDeviceChange?: (inputDeviceId: string, outputDeviceId: string) => void;
  onVolumeChange?: (input: number, output: number) => void;
}

export const AudioSettings: React.FC<Props> = ({
  onDeviceChange,
  onVolumeChange,
}) => {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('default');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('default');
  const [inputVolume, setInputVolume] = useState(80);
  const [outputVolume, setOutputVolume] = useState(80);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({ deviceId: device.deviceId, label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`, kind: 'audioinput' as const }));
      const outputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({ deviceId: device.deviceId, label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`, kind: 'audiooutput' as const }));
      setInputDevices(inputs);
      setOutputDevices(outputs);
      if (inputs.length > 0 && selectedInputId === 'default') setSelectedInputId(inputs[0].deviceId);
      if (outputs.length > 0 && selectedOutputId === 'default') setSelectedOutputId(outputs[0].deviceId);
    } catch (err) {
      setError('Failed to access audio devices. Please grant microphone permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (deviceId: string) => {
    setSelectedInputId(deviceId);
    onDeviceChange?.(deviceId, selectedOutputId);
  };

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutputId(deviceId);
    onDeviceChange?.(selectedInputId, deviceId);
  };

  const handleInputVolumeChange = (volume: number) => {
    setInputVolume(volume);
    onVolumeChange?.(volume, outputVolume);
  };

  const handleOutputVolumeChange = (volume: number) => {
    setOutputVolume(volume);
    onVolumeChange?.(inputVolume, volume);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-lemonade-accent/30 border-t-lemonade-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/15 rounded-xl">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <button onClick={loadDevices} className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Settings size={14} className="text-gray-400 dark:text-white/40" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-white/90">Audio Settings</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 font-medium">
            <Mic size={12} /> Microphone
          </label>
          <LemonSelect
            value={selectedInputId}
            onChange={handleInputChange}
            placeholder="Select microphone"
            className="h-8 text-xs"
            options={inputDevices.map((device) => ({ value: device.deviceId, label: device.label }))}
          />
          <div className="flex items-center gap-1.5">
            <LemonSlider value={inputVolume} onChange={handleInputVolumeChange} min={0} max={100} step={1} className="flex-1" />
            <span className="text-[11px] font-mono w-10 text-center text-gray-500 dark:text-white/40 bg-lemonade-bg dark:bg-white/[0.04] rounded px-2.5 py-1">
              {inputVolume}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 font-medium">
            <Speaker size={12} /> Speaker
          </label>
          <LemonSelect
            value={selectedOutputId}
            onChange={handleOutputChange}
            placeholder="Select speaker"
            className="h-8 text-xs"
            options={outputDevices.map((device) => ({ value: device.deviceId, label: device.label }))}
          />
          <div className="flex items-center gap-1.5">
            <LemonSlider value={outputVolume} onChange={handleOutputVolumeChange} min={0} max={100} step={1} className="flex-1" />
            <span className="text-[11px] font-mono w-10 text-center text-gray-500 dark:text-white/40 bg-lemonade-bg dark:bg-white/[0.04] rounded px-2.5 py-1">
              {outputVolume}%
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100/60 dark:border-white/[0.04]" />

      <div className="flex gap-1.5">
        <button
          onClick={loadDevices}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-white/40 border border-gray-200/50 dark:border-white/[0.08] rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
        >
          <RefreshCw size={11} />
          Refresh
        </button>
        <button
          onClick={() => {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0fPTgjMGHnO/7+CVUR0NUqPZ8bhlGQg8mtXy0X4uBSl+z+/glEoLEmCz5e6oWRULR5vc8b9gHgU2kNDzzXkrBSJ3xvDdj0AKE12y5vCrXRYMSaHd8b1dHgU3jtHzzXkqBSN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAK');
            audio.volume = outputVolume / 100;
            audio.play();
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-white/40 border border-gray-200/50 dark:border-white/[0.08] rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
        >
          <Volume2 size={11} />
          Test Sound
        </button>
      </div>
    </div>
  );
};
