import VideoResultCard from '../VideoResultCard';

export default function VideoResultCardExample() {
  // Mock video URL (placeholder)
  const mockVideoUrl = 'data:video/mp4;base64,AAAAFGZ0eXBpc29tAAACAGlzb21pc28y';

  const handleDownload = () => {
    console.log('Download video triggered');
  };

  const handleNewVideo = () => {
    console.log('Create new video triggered');
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <VideoResultCard 
        videoUrl={mockVideoUrl}
        filename="360_product_video_2025.mp4"
        fileSize={2500000} // 2.5 MB
        onDownload={handleDownload}
        onNewVideo={handleNewVideo}
      />
    </div>
  );
}