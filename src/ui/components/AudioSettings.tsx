import React, { useEffect, useState } from 'react';
import { Mic, Speaker, Volume2, Settings } from 'lucide-react';
import { AudioDevice } from '../../types';

interface Props {
  onDeviceChange?: (inputDeviceId: string, outputDeviceId: string) => void;
  onVolumeChange?: (input: number, output: number) => void;
}

export const AudioSettings: React.FC<Props> = ({ 
  onDeviceChange, 
  onVolumeChange 
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

      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get all audio devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: 'audioinput' as const,
        }));

      const outputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
          kind: 'audiooutput' as const,
        }));

      setInputDevices(inputs);
      setOutputDevices(outputs);

      // Set defaults if available
      if (inputs.length > 0 && selectedInputId === 'default') {
        setSelectedInputId(inputs[0].deviceId);
      }
      if (outputs.length > 0 && selectedOutputId === 'default') {
        setSelectedOutputId(outputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load audio devices:', err);
      setError('Failed to access audio devices. Please grant microphone permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (deviceId: string) => {
    setSelectedInputId(deviceId);
    if (onDeviceChange) {
      onDeviceChange(deviceId, selectedOutputId);
    }
  };

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutputId(deviceId);
    if (onDeviceChange) {
      onDeviceChange(selectedInputId, deviceId);
    }
  };

  const handleInputVolumeChange = (volume: number) => {
    setInputVolume(volume);
    if (onVolumeChange) {
      onVolumeChange(volume, outputVolume);
    }
  };

  const handleOutputVolumeChange = (volume: number) => {
    setOutputVolume(volume);
    if (onVolumeChange) {
      onVolumeChange(inputVolume, volume);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={loadDevices}
          className="mt-2 text-sm text-red-700 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white border border-gray-200 rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-800">Audio Settings</h3>
      </div>

      {/* Input Device */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Mic size={18} />
          <label>Microphone</label>
        </div>
        <select
          value={selectedInputId}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        >
          {inputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        {/* Input Volume */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Input Volume</span>
            <span className="font-mono">{inputVolume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={inputVolume}
            onChange={(e) => handleInputVolumeChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>
      </div>

      {/* Output Device */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Speaker size={18} />
          <label>Speaker</label>
        </div>
        <select
          value={selectedOutputId}
          onChange={(e) => handleOutputChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        >
          {outputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        {/* Output Volume */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Output Volume</span>
            <span className="font-mono">{outputVolume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={outputVolume}
            onChange={(e) => handleOutputVolumeChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>
      </div>

      {/* Test Buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={loadDevices}
          className="flex-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          Refresh Devices
        </button>
        <button
          onClick={() => {
            // Play test sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0fPTgjMGHnO/7+CVUR0NUqPZ8bhlGQg8mtXy0X4uBSl+z+/glEoLEmCz5e6oWRULR5vc8b9gHgU2kNDzzXkrBSJ3xvDdj0AKE12y5vCrXRYMSaHd8b1dHgU3jtHzzXkqBSN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAK');
            audio.volume = outputVolume / 100;
            audio.play();
          }}
          className="flex-1 px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Volume2 size={16} />
          Test Sound
        </button>
      </div>
    </div>
  );
};
