import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Play, Pause, RotateCcw, ExternalLink } from 'lucide-react';

interface VideoResultCardProps {
  videoUrl: string;
  filename: string;
  fileSize?: number;
  onDownload: () => void;
  onNewVideo: () => void;
}

export default function VideoResultCard({ 
  videoUrl, 
  filename, 
  fileSize, 
  onDownload, 
  onNewVideo 
}: VideoResultCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = () => {
    const video = document.getElementById('result-video') as HTMLVideoElement;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <Card className="overflow-hidden" data-testid="card-video-result">
      <div className="aspect-video bg-black relative">
        <video 
          id="result-video"
          src={videoUrl}
          className="w-full h-full object-contain"
          controls
          loop
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          data-testid="video-result-player"
        />
        
        <div className="absolute top-4 left-4">
          <Badge variant="default" className="bg-black/50 text-white border-white/20">
            360° Video
          </Badge>
        </div>
        
        <div className="absolute bottom-4 left-4 right-4 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePlayPause}
            className="bg-black/50 hover:bg-black/70 text-white border-white/20"
            data-testid="button-play-pause"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold" data-testid="text-video-filename">{filename}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>MP4 Video</span>
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
            <span>5 seconds</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={onDownload} 
            className="flex-1"
            data-testid="button-download-video"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Video
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onNewVideo}
            data-testid="button-create-new"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Video
          </Button>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Right-click the video to save or share directly
          </p>
        </div>
      </div>
    </Card>
  );
}