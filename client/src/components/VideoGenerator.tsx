import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Video, Wand2 } from 'lucide-react';
import FileUploadZone from './FileUploadZone';
import VideoProgressTracker from './VideoProgressTracker';
import VideoResultCard from './VideoResultCard';

type GenerationStatus = 'idle' | 'uploading' | 'generating-prompt' | 'creating-video' | 'processing' | 'completed' | 'error';

interface GenerationResult {
  videoUrl: string;
  filename: string;
  fileSize: number;
}

export default function VideoGenerator() {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [productName, setProductName] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const { toast } = useToast();

  const generateVideo = async () => {
    if (!selectedFile) {
      toast({
        title: 'No image selected',
        description: 'Please upload a product image first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Reset states
      setResult(null);
      setStatus('uploading');
      setProgress(10);

      // Convert image to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      setStatus('generating-prompt');
      setProgress(30);

      // Call our backend API (which will proxy to n8n to avoid CORS)
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: base64,
          product_name: productName || 'Product',
        }),
      });

      setStatus('creating-video');
      setProgress(50);

      if (!response.ok) {
        throw new Error('Video generation failed');
      }

      // Simulate processing time
      const processingInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 95));
      }, 1000);

      // Wait for response
      const videoBlob = await response.blob();
      clearInterval(processingInterval);

      setStatus('completed');
      setProgress(100);

      // Create result
      const videoUrl = URL.createObjectURL(videoBlob);
      const filename = `360_${productName.replace(/\\s+/g, '_')}_${Date.now()}.mp4`;
      
      setResult({
        videoUrl,
        filename,
        fileSize: videoBlob.size,
      });

      toast({
        title: '360° Video Generated!',
        description: 'Your product video is ready for download.',
      });

    } catch (error) {
      console.error('Video generation error:', error);
      setStatus('error');
      toast({
        title: 'Generation Failed',
        description: 'There was an error creating your video. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadVideo = () => {
    if (result) {
      const link = document.createElement('a');
      link.href = result.videoUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download Started',
        description: 'Your video is being downloaded.',
      });
    }
  };

  const startNewVideo = () => {
    setSelectedFile(undefined);
    setProductName('');
    setStatus('idle');
    setProgress(0);
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Video className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">360° Product Video Generator</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Transform your product photos into professional 360-degree rotation videos using AI. 
          Perfect for e-commerce, marketing, and product showcases.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Upload & Configure</h2>
              </div>
              
              <FileUploadZone
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
              />

              <div className="space-y-2">
                <Label htmlFor="productName">Product Name (Optional)</Label>
                <Input
                  id="productName"
                  placeholder="e.g., Wireless Headphones, Coffee Mug..."
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  data-testid="input-product-name"
                />
              </div>

              <Button
                onClick={generateVideo}
                disabled={!selectedFile || status === 'creating-video' || status === 'processing'}
                className="w-full"
                size="lg"
                data-testid="button-generate-video"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {status === 'creating-video' || status === 'processing' 
                  ? 'Generating Video...' 
                  : 'Generate 360° Video'
                }
              </Button>
            </div>
          </Card>
        </div>

        {/* Progress & Result Section */}
        <div className="space-y-6">
          <VideoProgressTracker 
            status={status}
            progress={progress}
            message={status === 'creating-video' ? 'AI is creating your 360° rotation video...' : undefined}
          />

          {result && (
            <VideoResultCard
              videoUrl={result.videoUrl}
              filename={result.filename}
              fileSize={result.fileSize}
              onDownload={downloadVideo}
              onNewVideo={startNewVideo}
            />
          )}
        </div>
      </div>

      {/* Features Info */}
      <Card className="p-6 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <h3 className="font-semibold mb-2">🤖 AI-Powered</h3>
            <p className="text-sm text-muted-foreground">
              Advanced AI generates professional video prompts automatically
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">⚡ Fast Generation</h3>
            <p className="text-sm text-muted-foreground">
              High-quality 360° videos ready in under 60 seconds
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">📱 Ready to Use</h3>
            <p className="text-sm text-muted-foreground">
              Perfect for websites, social media, and marketing campaigns
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}