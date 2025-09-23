import { useState } from 'react';
import FileUploadZone from '../FileUploadZone';

export default function FileUploadZoneExample() {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();

  const handleFileSelect = (file: File) => {
    console.log('File selected:', file.name);
    setSelectedFile(file);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <FileUploadZone 
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
      />
    </div>
  );
}