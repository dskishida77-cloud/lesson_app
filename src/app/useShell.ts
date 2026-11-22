import { useEffect, useMemo, useState } from 'react';
import { AudioService } from '../audio/AudioService';
import { SettingsStore } from './SettingsStore';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useToast } from './useToast';

/** ローカル対戦とオンライン対戦で、共通に使う状態（効果音、設定、視覚効果の低減、通知） */
export interface Shell {
  audio: AudioService;
  soundEnabled: boolean;
  toggleSound: () => void;
  reducedMotion: boolean;
  toast: { message: string | null; show: (text: string) => void };
}

export function useShell(): Shell {
  const audio = useMemo(() => new AudioService(), []);
  const settings = useMemo(() => new SettingsStore(), []);
  const [soundEnabled, setSoundEnabled] = useState(() => settings.load().soundEnabled);
  useEffect(() => audio.setEnabled(soundEnabled), [audio, soundEnabled]);
  const reducedMotion = usePrefersReducedMotion();
  const toast = useToast();

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    settings.save({ soundEnabled: next });
  };

  return { audio, soundEnabled, toggleSound, reducedMotion, toast };
}
