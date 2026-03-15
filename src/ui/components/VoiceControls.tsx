import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Activity } from 'lucide-react';

interface Props {
  isRecording: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;
  isVADActive: boolean;
  onToggleRecording: () => void;
  onToggleMute: () => void;
}

export const VoiceControls: React.FC<Props> = ({
  isRecording,
  isSpeaking,
  isMuted,
  audioLevel,
  isVADActive,
  onToggleRecording,
  onToggleMute,
}) => {
  return (
    <div className="bg-white dark:bg-lemonade-dark-surface border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-8 shadow-sm transition-colors duration-300">
      <div className="flex items-center justify-between gap-8">
        {/* Recording Button */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={onToggleRecording}
            disabled={isMuted}
            className={`relative p-5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 shadow-lg'
                : 'bg-primary-500 hover:bg-primary-600 shadow-md'
            }`}
          >
            {isRecording ? (
              <MicOff size={28} className="text-white" />
            ) : (
              <Mic size={28} className="text-white" />
            )}
            {isRecording && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75"></span>
            )}
          </button>
          <span className="text-xs font-medium text-gray-500 dark:text-white/40">
            {isRecording ? 'Stop' : 'Start'} Recording
          </span>
        </div>

        {/* Audio Level Meter */}
        <div className="flex-1 max-w-md">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/40">
              <span className="flex items-center gap-1.5">
                <Activity size={14} />
                Audio Level
              </span>
              <span className="font-mono text-gray-600 dark:text-white/60">
                {Math.round(audioLevel * 100)}%
              </span>
            </div>
            <div className="relative h-3 bg-gray-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-100 rounded-full ${
                  audioLevel > 0.8
                    ? 'bg-red-500'
                    : audioLevel > 0.5
                    ? 'bg-lemonade-accent-hover'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* VAD Indicator */}
          {isVADActive && (
            <div className="mt-2.5 flex items-center gap-2.5 text-xs text-blue-600 dark:text-blue-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Voice detected
            </div>
          )}
        </div>

        {/* Mute Button */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={onToggleMute}
            className={`p-5 rounded-full transition-all duration-200 ${
              isMuted
                ? 'bg-gray-400 hover:bg-gray-500'
                : 'bg-gray-700 hover:bg-gray-800'
            } shadow-md`}
          >
            {isMuted ? (
              <VolumeX size={28} className="text-white" />
            ) : (
              <Volume2 size={28} className="text-white" />
            )}
          </button>
          <span className="text-xs font-medium text-gray-500 dark:text-white/40">
            {isMuted ? 'Unmute' : 'Mute'}
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-col gap-2.5 min-w-[120px]">
          <div
            className={`flex items-center gap-2.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
              isRecording
                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                : 'bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-white/40'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300 dark:bg-white/20'
              }`}
            />
            {isRecording ? 'Recording' : 'Ready'}
          </div>

          {isSpeaking && (
            <div className="flex items-center gap-2.5 text-sm font-medium px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              AI Speaking
            </div>
          )}

          {isMuted && (
            <div className="flex items-center gap-2.5 text-sm font-medium px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <VolumeX size={14} />
              Muted
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
