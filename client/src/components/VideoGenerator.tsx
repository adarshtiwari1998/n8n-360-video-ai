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

type GenerationStatus = 'idle' | 'uploading' | 'webhook-triggered' | 'analyzing-image' | 'generating-prompt' | 'creating-video' | 'processing-video' | 'completed' | 'error';

interface GenerationResult {
  videoUrl: string;
  filename: string;
  fileSize: number;
}

interface WorkflowStep {
  step: number;
  name: string;
  description: string;
  completed: boolean;
  timestamp?: string;
}

export default function VideoGenerator() {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [productName, setProductName] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const { toast } = useToast();

  const initializeWorkflowSteps = () => {
    const steps: WorkflowStep[] = [
      { step: 1, name: 'Webhook Triggered', description: 'Initiating n8n workflow...', completed: false },
      { step: 2, name: 'GLM-4V Analysis', description: 'AI analyzing product image...', completed: false },
      { step: 3, name: 'Prompt Generation', description: 'Creating 360° video prompt...', completed: false },
      { step: 4, name: 'Gemini Veo3 Video', description: 'Generating 360° rotation video...', completed: false },
      { step: 5, name: 'Video Processing', description: 'Processing and optimizing video...', completed: false },
      { step: 6, name: 'Complete', description: 'Video ready for download!', completed: false }
    ];
    setWorkflowSteps(steps);
    return steps;
  };

  const updateWorkflowStep = (stepNumber: number, completed: boolean = true) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.step === stepNumber 
        ? { ...step, completed, timestamp: completed ? new Date().toLocaleTimeString() : undefined }
        : step
    ));
  };

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
      // Reset states and initialize workflow tracking
      setResult(null);
      const currentSessionId = `session_${Date.now()}`;
      setSessionId(currentSessionId);
      const steps = initializeWorkflowSteps();
      
      setStatus('uploading');
      setProgress(5);

      console.log(`🚀 [Frontend] Starting video generation for session: ${currentSessionId}`);

      // Convert image to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      console.log(`📸 [Frontend] Image converted to base64, size: ${Math.round((base64.length * 0.75) / 1024)} KB`);

      // Step 1: Webhook triggered
      setStatus('webhook-triggered');
      setProgress(15);
      updateWorkflowStep(1);
      console.log(`🔗 [Frontend] Step 1: Triggering n8n webhook...`);

      // Call our backend API (which will proxy to n8n)
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: base64,
          product_name: productName || 'Product',
        }),
      });

      console.log(`✅ [Frontend] Backend response status: ${response.status}`);

      if (!response.ok) {
        throw new Error('Video generation failed');
      }

      // Simulate workflow steps with realistic timing
      const simulateWorkflowProgress = () => {
        const stepTimings = [
          { step: 2, status: 'analyzing-image', progress: 30, delay: 2000 },
          { step: 3, status: 'generating-prompt', progress: 45, delay: 3000 },
          { step: 4, status: 'creating-video', progress: 65, delay: 5000 },
          { step: 5, status: 'processing-video', progress: 85, delay: 3000 }
        ];

        stepTimings.forEach(({ step, status, progress, delay }) => {
          setTimeout(() => {
            setStatus(status as GenerationStatus);
            setProgress(progress);
            updateWorkflowStep(step);
            console.log(`🔄 [Frontend] Step ${step}: ${status} (${progress}%)`);
          }, delay);
        });
      };

      simulateWorkflowProgress();

      // Wait for video response
      console.log(`⏳ [Frontend] Waiting for video generation to complete...`);
      const videoBlob = await response.blob();
      
      // Step 6: Complete
      setStatus('completed');
      setProgress(100);
      updateWorkflowStep(6);
      console.log(`🎉 [Frontend] Video generation completed! Size: ${Math.round(videoBlob.size / 1024)} KB`);

      // Create result
      const videoUrl = URL.createObjectURL(videoBlob);
      const filename = `360_${productName.replace(/\\s+/g, '_')}_${Date.now()}.mp4`;
      
      setResult({
        videoUrl,
        filename,
        fileSize: videoBlob.size,
      });

      toast({
        title: '🎬 360° Video Generated!',
        description: `Your ${productName || 'product'} video is ready for download.`,
      });

    } catch (error) {
      console.error(`❌ [Frontend] Video generation error:`, error);
      setStatus('error');
      
      // Mark current step as failed
      setWorkflowSteps(prev => prev.map(step => 
        !step.completed ? { ...step, completed: false, timestamp: 'Failed' } : step
      ));
      
      toast({
        title: 'Generation Failed',
        description: 'There was an error creating your video. Check the console for detailed logs.',
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
    setWorkflowSteps([]);
    setSessionId('');
    console.log(`🔄 [Frontend] Starting new video generation session`);
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
                disabled={!selectedFile || status === 'creating-video' || status === 'processing-video'}
                className="w-full"
                size="lg"
                data-testid="button-generate-video"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {status === 'creating-video' || status === 'processing-video' 
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

          {/* Detailed Workflow Steps */}
          {workflowSteps.length > 0 && (
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  n8n Workflow Progress
                </h3>
                <div className="space-y-3">
                  {workflowSteps.map((step) => (
                    <div key={step.step} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      step.completed ? 'bg-green-50 dark:bg-green-900/20' : 
                      status !== 'idle' && !step.completed ? 'bg-blue-50 dark:bg-blue-900/20' : 
                      'bg-muted/30'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        step.completed ? 'bg-green-500 text-white' :
                        status !== 'idle' && !step.completed ? 'bg-blue-500 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {step.completed ? '✓' : step.step}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{step.name}</div>
                        <div className="text-sm text-muted-foreground">{step.description}</div>
                      </div>
                      {step.timestamp && (
                        <div className="text-xs text-muted-foreground">
                          {step.timestamp}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {sessionId && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Session ID: <code className="bg-muted px-1 rounded">{sessionId}</code>
                  </div>
                )}
              </div>
            </Card>
          )}

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