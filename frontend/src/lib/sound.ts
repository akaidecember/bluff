import { useCallback, useMemo } from "react";

const DEFAULT_VOLUME = 0.12;

type SoundKey = "turn" | "claim" | "reveal";

type SoundOptions = {
  volume?: number;
};

type SoundPlayer = {
  play: (key: SoundKey, options?: SoundOptions) => void;
};

const isBrowser = typeof window !== "undefined";

export function useSound(): SoundPlayer {
  const audioContext = useMemo(() => {
    if (!isBrowser) {
      return null;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    return new AudioContextClass();
  }, []);

  const play = useCallback(
    (key: SoundKey, options?: SoundOptions) => {
      if (!audioContext) {
        return;
      }
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const now = audioContext.currentTime;

      const frequencyMap: Record<SoundKey, number> = {
        turn: 520,
        claim: 420,
        reveal: 620,
      };

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequencyMap[key], now);
      gainNode.gain.setValueAtTime(options?.volume ?? DEFAULT_VOLUME, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.2);
    },
    [audioContext]
  );

  return { play };
}
