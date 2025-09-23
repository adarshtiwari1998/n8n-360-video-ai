import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Zap, Download } from 'lucide-react';

interface VideoProgressTrackerProps {
  status: 'idle' | 'uploading' | 'webhook-triggered' | 'analyzing-image' | 'generating-prompt' | 'creating-video' | 'processing-video' | 'completed' | 'error';
  progress: number;
  message?: string;
}

export default function VideoProgressTracker({ status, progress, message }: VideoProgressTrackerProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'uploading':
        return {
          icon: <Zap className="w-4 h-4" />,
          label: 'Uploading',
          color: 'bg-blue-500' as const,
          variant: 'default' as const
        };
      case 'webhook-triggered':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Webhook Triggered',
          color: 'bg-indigo-500' as const,
          variant: 'secondary' as const
        };
      case 'analyzing-image':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Analyzing Image',
          color: 'bg-purple-500' as const,
          variant: 'secondary' as const
        };
      case 'generating-prompt':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Generating Prompt',
          color: 'bg-purple-600' as const,
          variant: 'secondary' as const
        };
      case 'creating-video':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Creating Video',
          color: 'bg-orange-500' as const,
          variant: 'default' as const
        };
      case 'processing-video':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Processing Video',
          color: 'bg-yellow-500' as const,
          variant: 'secondary' as const
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Completed',
          color: 'bg-green-500' as const,
          variant: 'default' as const
        };
      case 'error':
        return {
          icon: <Download className="w-4 h-4" />,
          label: 'Error',
          color: 'bg-red-500' as const,
          variant: 'destructive' as const
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Ready',
          color: 'bg-gray-500' as const,
          variant: 'outline' as const
        };
    }
  };

  if (status === 'idle') return null;

  const config = getStatusConfig(status);

  return (
    <Card className="p-6" data-testid="card-video-progress">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config.icon}
            <h3 className="font-semibold">Video Generation</h3>
          </div>
          <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
            {config.label}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono" data-testid="text-progress-percent">{animatedProgress}%</span>
          </div>
          <Progress value={animatedProgress} className="h-2" />
        </div>

        {message && (
          <p className="text-sm text-muted-foreground" data-testid="text-status-message">
            {message}
          </p>
        )}

        {(status === 'creating-video' || status === 'processing-video') && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              {status === 'creating-video' 
                ? '🎬 Gemini Veo3 is creating your 360° video... This typically takes 30-60 seconds'
                : '⚙️ Processing and optimizing your video for download...'
              }
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}