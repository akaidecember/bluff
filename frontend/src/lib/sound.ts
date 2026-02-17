import { useCallback, useMemo } from "react";

const DEFAULT_VOLUME = 0.12;

type SoundKey = "turn" | "claim" | "reveal" | "hover" | "click" | "fall" | "shuffle";

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
      const now = audioContext.currentTime;
      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const volume = options?.volume ?? DEFAULT_VOLUME;

      const playTone = (type: OscillatorType, startFreq: number, endFreq: number | null, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(startFreq, now);
        if (endFreq !== null) {
          oscillator.frequency.linearRampToValueAtTime(endFreq, now + duration);
        }
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      };

      const playNoise = (
        duration: number,
        lowpass: number,
        highpass?: number,
        startDelay = 0,
        peak = volume
      ) => {
        const bufferSize = Math.floor(audioContext.sampleRate * duration);
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i += 1) {
          data[i] = Math.random() * 2 - 1;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        const startTime = now + startDelay;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = "lowpass";
        lowpassFilter.frequency.setValueAtTime(lowpass, startTime);
        lowpassFilter.frequency.linearRampToValueAtTime(Math.max(200, lowpass * 0.6), startTime + duration);

        let lastNode: AudioNode = source;
        if (highpass) {
          const highpassFilter = audioContext.createBiquadFilter();
          highpassFilter.type = "highpass";
          highpassFilter.frequency.setValueAtTime(highpass, startTime);
          lastNode.connect(highpassFilter);
          lastNode = highpassFilter;
        }

        lastNode.connect(lowpassFilter);
        lowpassFilter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start(startTime);
        source.stop(startTime + duration);
      };

      switch (key) {
        case "turn":
          playTone("sine", 520, null, 0.18);
          break;
        case "claim":
          playTone("sine", 420, null, 0.18);
          break;
        case "reveal":
          playTone("sine", 620, null, 0.2);
          break;
        case "click":
          playTone("square", 1200, 800, 0.06);
          break;
        case "hover":
          playNoise(0.1, 1400, 260, 0, volume * 0.28);
          playNoise(0.06, 1100, 220, 0.035, volume * 0.22);
          break;
        case "fall":
          playTone("triangle", 560, 320, 0.14);
          break;
        case "shuffle":
          playNoise(0.32, 1200, 160);
          break;
        default:
          break;
      }
    },
    [audioContext]
  );

  return { play };
}
