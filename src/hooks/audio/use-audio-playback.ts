import { useRef } from "react";
import { useAnnotatorStore } from "@/stores/audio";

export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playTokenRef = useRef(0);

  const setPlaying = useAnnotatorStore((s) => s.setPlaying);
  const setCurrentTime = useAnnotatorStore((s) => s.setCurrentTime);
  const selectFile = useAnnotatorStore((s) => s.selectFile);
  const files = useAnnotatorStore((s) => s.files);
  const currentFileIndex = useAnnotatorStore((s) => s.currentFileIndex);

  const play = () => {
    audioRef.current?.play();
    setPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipBackward = (seconds = 5) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - seconds);
    setCurrentTime(audio.currentTime);
  };

  const skipForward = (seconds = 5) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || 0;
    audio.currentTime = Math.min(dur, audio.currentTime + seconds);
    setCurrentTime(audio.currentTime);
  };

  const playRange = (start: number, end: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const token = ++playTokenRef.current;
    audio.currentTime = start;
    setCurrentTime(start);
    audio.play();
    setPlaying(true);

    const checkEnd = () => {
      if (playTokenRef.current !== token) return;
      if (!audio || audio.paused) return;

      if (audio.currentTime >= end - 0.05) {
        audio.pause();
        audio.currentTime = end;
        setCurrentTime(end);
        setPlaying(false);
        return;
      }
      requestAnimationFrame(checkEnd);
    };
    requestAnimationFrame(checkEnd);
  };

  const previousFile = () => {
    if (currentFileIndex > 0) {
      selectFile(currentFileIndex - 1);
    }
  };

  const nextFile = () => {
    if (currentFileIndex < files.length - 1) {
      selectFile(currentFileIndex + 1);
    }
  };

  return {
    audioRef,
    play,
    pause,
    togglePlayPause,
    seek,
    skipBackward,
    skipForward,
    playRange,
    previousFile,
    nextFile,
  };
}
