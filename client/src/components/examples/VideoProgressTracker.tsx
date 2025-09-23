import { useState, useEffect } from 'react';
import VideoProgressTracker from '../VideoProgressTracker';

export default function VideoProgressTrackerExample() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'generating-prompt' | 'creating-video' | 'processing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sequence = [
      { status: 'uploading' as const, progress: 25, delay: 1000 },
      { status: 'generating-prompt' as const, progress: 50, delay: 2000 },
      { status: 'creating-video' as const, progress: 75, delay: 3000 },
      { status: 'processing' as const, progress: 90, delay: 4000 },
      { status: 'completed' as const, progress: 100, delay: 5000 },
    ];

    sequence.forEach(({ status: newStatus, progress: newProgress, delay }) => {
      setTimeout(() => {
        setStatus(newStatus);
        setProgress(newProgress);
      }, delay);
    });
  }, []);

  return (
    <div className="max-w-md mx-auto p-4">
      <VideoProgressTracker 
        status={status}
        progress={progress}
        message={status === 'creating-video' ? 'AI is generating your 360° video...' : undefined}
      />
    </div>
  );
}