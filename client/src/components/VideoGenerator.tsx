import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Search, Video, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ShopifyProduct } from "@shared/schema";

export default function VideoGenerator() {
  const [activeTab, setActiveTab] = useState<"upload" | "shopify">("upload");
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [productName, setProductName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"title" | "sku">("title");
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>("");
  
  const { toast } = useToast();

  const shopifySearchMutation = useMutation({
    mutationFn: async (params: { query: string; searchType: string }) => {
      const res = await apiRequest('POST', '/api/shopify/search', params);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.products && data.products.length === 0) {
        toast({
          title: "No products found",
          description: "Try a different search query",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const videoGenerationMutation = useMutation({
    mutationFn: async (data: { imageData: string; additionalImages?: string[]; productName: string }) => {
      setGenerationProgress(10);
      
      const res = await fetch('/api/generate-360-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      setGenerationProgress(50);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || 'Video generation failed');
      }

      setGenerationProgress(90);
      const blob = await res.blob();
      setGenerationProgress(100);
      return blob;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      toast({
        title: "Success!",
        description: "360° video generated successfully",
      });
    },
    onError: (error: Error) => {
      setGenerationProgress(0);
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      if (!productName) {
        setProductName(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProductSelect = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setProductName(product.title);
    if (product.images && product.images.length > 0) {
      setSelectedImage(product.images[0].url);
      // Set additional images from Shopify (skip first image as it's the main one)
      if (product.images.length > 1) {
        setAdditionalImages(product.images.slice(1).map(img => img.url));
      } else {
        setAdditionalImages([]);
      }
    }
  };

  const handleAdditionalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const readers: Promise<string>[] = [];
    
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      readers.push(new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }));
    }

    Promise.all(readers).then(images => {
      setAdditionalImages(prev => [...prev, ...images]);
    });
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateVideo = () => {
    if (!selectedImage) {
      toast({
        title: "No image selected",
        description: "Please upload an image or select a product",
        variant: "destructive",
      });
      return;
    }

    if (!productName) {
      toast({
        title: "Product name required",
        description: "Please enter a product name",
        variant: "destructive",
      });
      return;
    }

    setGenerationProgress(0);
    setVideoUrl("");
    videoGenerationMutation.mutate({
      imageData: selectedImage,
      additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
      productName,
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="container-video-generator">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2" data-testid="heading-main">360° Product Video Generator</h1>
        <p className="text-muted-foreground" data-testid="text-description">
          Create stunning 360° product videos using AI - Upload an image or search from Shopify
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Card data-testid="card-input">
            <CardHeader>
              <CardTitle data-testid="heading-source">Select Product Source</CardTitle>
              <CardDescription data-testid="text-source-description">
                Choose to upload an image or search from your Shopify store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "shopify")} data-testid="tabs-source">
                <TabsList className="grid w-full grid-cols-2" data-testid="tabs-list">
                  <TabsTrigger value="upload" data-testid="tab-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </TabsTrigger>
                  <TabsTrigger value="shopify" data-testid="tab-shopify">
                    <Search className="w-4 h-4 mr-2" />
                    Search Shopify
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4" data-testid="content-upload">
                  <div>
                    <Label htmlFor="image-upload" data-testid="label-image">Main Product Image</Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="cursor-pointer"
                      data-testid="input-image-file"
                    />
                  </div>
                  <div>
                    <Label htmlFor="additional-images" data-testid="label-additional">Additional Angles (Optional - up to 5 images)</Label>
                    <Input
                      id="additional-images"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleAdditionalImageUpload}
                      className="cursor-pointer"
                      data-testid="input-additional-images"
                    />
                    {additionalImages.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {additionalImages.map((img, idx) => (
                          <div key={idx} className="relative group" data-testid={`preview-additional-${idx}`}>
                            <img src={img} alt={`Additional ${idx + 1}`} className="w-16 h-16 object-cover rounded border" />
                            <button
                              onClick={() => removeAdditionalImage(idx)}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-${idx}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="product-name" data-testid="label-product-name">Product Name</Label>
                    <Input
                      id="product-name"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Enter product name"
                      data-testid="input-product-name"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="shopify" className="space-y-4" data-testid="content-shopify">
                  <div className="flex gap-2">
                    <Select value={searchType} onValueChange={(v) => setSearchType(v as "title" | "sku")}>
                      <SelectTrigger className="w-[140px]" data-testid="select-search-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="title" data-testid="option-search-title">Title</SelectItem>
                        <SelectItem value="sku" data-testid="option-search-sku">SKU</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search by ${searchType}...`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery) {
                          shopifySearchMutation.mutate({ query: searchQuery, searchType });
                        }
                      }}
                      data-testid="input-search-query"
                    />
                    <Button
                      onClick={() => {
                        if (searchQuery) {
                          shopifySearchMutation.mutate({ query: searchQuery, searchType });
                        }
                      }}
                      disabled={!searchQuery || shopifySearchMutation.isPending}
                      data-testid="button-search"
                    >
                      {shopifySearchMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {shopifySearchMutation.data?.products && shopifySearchMutation.data.products.length > 0 && (
                    <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-2" data-testid="list-products">
                      {shopifySearchMutation.data.products.map((product: ShopifyProduct) => (
                        <div
                          key={product.id}
                          onClick={() => handleProductSelect(product)}
                          className={`p-3 border rounded cursor-pointer hover:bg-accent transition-colors ${
                            selectedProduct?.id === product.id ? 'bg-accent border-primary' : ''
                          }`}
                          data-testid={`card-product-${product.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {product.images && product.images[0] && (
                              <img
                                src={product.images[0].url}
                                alt={product.title}
                                className="w-16 h-16 object-cover rounded"
                                data-testid={`img-product-${product.id}`}
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold" data-testid={`text-product-title-${product.id}`}>{product.title}</h3>
                              {product.variants && product.variants[0]?.sku && (
                                <p className="text-sm text-muted-foreground" data-testid={`text-product-sku-${product.id}`}>
                                  SKU: {product.variants[0].sku}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {selectedImage && (
                <div className="mt-4" data-testid="preview-image">
                  <Label data-testid="label-preview">Selected Image Preview</Label>
                  <div className="mt-2 border rounded-lg p-2">
                    <img
                      src={selectedImage}
                      alt="Selected product"
                      className="w-full h-64 object-contain"
                      data-testid="img-preview"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleGenerateVideo}
                disabled={!selectedImage || !productName || videoGenerationMutation.isPending}
                className="w-full mt-4"
                size="lg"
                data-testid="button-generate"
              >
                {videoGenerationMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Generate 360° Video
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card data-testid="card-output">
            <CardHeader>
              <CardTitle data-testid="heading-result">Video Generation Result</CardTitle>
              <CardDescription data-testid="text-result-description">
                Your generated 360° product video will appear here
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {videoGenerationMutation.isPending && (
                <div className="space-y-2" data-testid="status-generating">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" data-testid="text-progress">Generating video...</span>
                    <span className="text-sm text-muted-foreground" data-testid="text-progress-percent">{generationProgress}%</span>
                  </div>
                  <Progress value={generationProgress} className="w-full" data-testid="progress-bar" />
                  <Alert data-testid="alert-progress">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <AlertDescription data-testid="text-progress-message">
                      {generationProgress < 20 && "Uploading image to ImageKit..."}
                      {generationProgress >= 20 && generationProgress < 50 && "Analyzing image with Gemini AI..."}
                      {generationProgress >= 50 && generationProgress < 90 && "Generating 360° video with Gemini Veo..."}
                      {generationProgress >= 90 && "Finalizing video..."}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {videoUrl && (
                <div className="space-y-4" data-testid="result-video">
                  <Alert className="border-green-500 bg-green-50 dark:bg-green-950" data-testid="alert-success">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200" data-testid="text-success">
                      Video generated successfully!
                    </AlertDescription>
                  </Alert>
                  <div className="border rounded-lg overflow-hidden" data-testid="container-video-player">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full"
                      data-testid="video-player"
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                  <Button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = videoUrl;
                      a.download = `${productName.replace(/[^a-z0-9]/gi, '_')}_360_video.mp4`;
                      a.click();
                    }}
                    className="w-full"
                    data-testid="button-download"
                  >
                    Download Video
                  </Button>
                </div>
              )}

              {videoGenerationMutation.isError && (
                <Alert variant="destructive" data-testid="alert-error">
                  <XCircle className="w-4 h-4" />
                  <AlertDescription data-testid="text-error">
                    {videoGenerationMutation.error?.message || 'Video generation failed'}
                  </AlertDescription>
                </Alert>
              )}

              {!videoGenerationMutation.isPending && !videoUrl && !videoGenerationMutation.isError && (
                <div className="text-center py-12 text-muted-foreground" data-testid="placeholder-empty">
                  <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p data-testid="text-empty">Select an image and generate a video to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
