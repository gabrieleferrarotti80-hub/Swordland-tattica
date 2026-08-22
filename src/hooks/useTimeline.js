import { useState, useEffect } from 'react';

export const useTimeline = () => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      const msPerTick = 1000 / playbackSpeed;
      interval = setInterval(() => {
        setCurrentTime((prevTime) => (prevTime >= 60 ? 60 : prevTime + 1));
      }, msPerTick);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  return { currentTime, setCurrentTime, isPlaying, setIsPlaying, playbackSpeed, setPlaybackSpeed, togglePlay };
};