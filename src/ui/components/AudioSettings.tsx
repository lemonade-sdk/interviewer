import React, { useEffect, useState } from 'react';
import { Mic, Speaker, Volume2, Settings, RefreshCw } from 'lucide-react';
import { AudioDevice } from '../../types';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

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
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-destructive text-sm">{error}</p>
        <button onClick={loadDevices} className="mt-2 text-sm text-destructive underline hover:no-underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">Audio Settings</h3>
      </div>

      {/* Microphone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Mic size={12} /> Microphone
          </Label>
          <Select value={selectedInputId} onValueChange={handleInputChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select microphone" />
            </SelectTrigger>
            <SelectContent>
              {inputDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Slider
              value={[inputVolume]}
              onValueChange={([v]) => handleInputVolumeChange(v)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <Badge variant="secondary" className="text-[10px] font-mono w-10 justify-center">
              {inputVolume}%
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Speaker size={12} /> Speaker
          </Label>
          <Select value={selectedOutputId} onValueChange={handleOutputChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select speaker" />
            </SelectTrigger>
            <SelectContent>
              {outputDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Slider
              value={[outputVolume]}
              onValueChange={([v]) => handleOutputVolumeChange(v)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <Badge variant="secondary" className="text-[10px] font-mono w-10 justify-center">
              {outputVolume}%
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={loadDevices} className="gap-1.5 text-xs">
          <RefreshCw size={12} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0fPTgjMGHnO/7+CVUR0NUqPZ8bhlGQg8mtXy0X4uBSl+z+/glEoLEmCz5e6oWRULR5vc8b9gHgU2kNDzzXkrBSJ3xvDdj0AKE12y5vCrXRYMSaHd8b1dHgU3jtHzzXkqBSN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAKElux5/CsXhYMR6Le8bxcHwU3jdHz0HkqBCN2x/DckEAK');
            audio.volume = outputVolume / 100;
            audio.play();
          }}
          className="gap-1.5 text-xs"
        >
          <Volume2 size={12} />
          Test Sound
        </Button>
      </div>
    </div>
  );
};
