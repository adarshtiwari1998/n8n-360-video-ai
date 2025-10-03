import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { shopifyProductSchema } from "@shared/schema";
import crypto from "crypto";
import { GoogleAuth } from 'google-auth-library';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

interface ImageKitResponse {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  size: number;
  fileType: string;
}

async function uploadToImageKit(imageData: string, fileName: string): Promise<ImageKitResponse> {
  const imagekitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!imagekitPrivateKey) {
    throw new Error('ImageKit IMAGEKIT_PRIVATE_KEY not configured');
  }

  const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
  
  const formData = new FormData();
  
  if (isUrl) {
    console.log('Uploading image from URL to ImageKit:', imageData);
    formData.append('file', imageData);
  } else {
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    console.log('Uploading base64 image to ImageKit');
    formData.append('file', base64Data);
  }
  
  formData.append('fileName', fileName);
  formData.append('useUniqueFileName', 'true');

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: 'upload.imagekit.io',
      path: '/api/v1/files/upload',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString('base64')}`,
        ...formData.getHeaders(),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          console.log('ImageKit upload successful:', result.url);
          resolve(result);
        } else {
          console.error('ImageKit upload failed. Response:', data);
          reject(new Error(`ImageKit upload failed: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    formData.pipe(req);
  });
}

async function analyzeImageWithGemini(imageDataOrUrl: string, productName: string) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  let base64Data: string;
  
  // Check if it's a URL or base64
  const isUrl = imageDataOrUrl.startsWith('http://') || imageDataOrUrl.startsWith('https://');
  
  if (isUrl) {
    // Fetch the image from URL and convert to base64
    console.log('Fetching image from URL:', imageDataOrUrl);
    const imageResponse = await fetch(imageDataOrUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    base64Data = Buffer.from(imageBuffer).toString('base64');
  } else {
    // It's already base64, just clean it up
    base64Data = imageDataOrUrl.includes(',') ? imageDataOrUrl.split(',')[1] : imageDataOrUrl;
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data
              }
            },
            {
              text: `Analyze this ${productName} image and create a detailed description for 360-degree video generation. Focus on: product type, key features, materials, colors, textures, and visual characteristics. Be specific and descriptive for AI video generation.`
            }
          ]
        }]
      })
    }
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
  }

  const geminiData = await geminiResponse.json();
  
  if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid Gemini response: ' + JSON.stringify(geminiData));
  }

  const description = geminiData.candidates[0].content.parts[0].text;
  
  const videoPrompt = `The exact ${productName} from the reference image rotates smoothly on a seamless pure white studio background. Perfect 360-degree turntable camera movement around the product. Professional studio lighting setup with bright, even illumination and subtle soft shadows beneath the product only. Pristine white backdrop with no gradients or color variations. The product maintains its exact appearance, colors, materials, and details from the reference image. Clean e-commerce product photography style. Modern commercial aesthetic with minimalist white environment. Camera: steady circular dolly shot. Lighting: bright key light, soft fill, white bounce cards. 8 seconds duration.`;

  return { description, videoPrompt };
}

async function generateVideoWithVertexAI(prompt: string, productName: string, productImageData?: string | string[]) {
  const projectId = process.env.VERTEX_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('VERTEX_PROJECT_ID not configured');
  }

  console.log('Generating video with Vertex AI Veo 2 (Experimental with image conditioning)...');
  
  const credentialsPath = path.join(process.cwd(), 'credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    throw new Error('credentials.json file not found. Please add your service account credentials.');
  }

  const fileContent = fs.readFileSync(credentialsPath, 'utf-8');
  const credentials = JSON.parse(fileContent);
  
  const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  
  if (!accessToken.token) {
    throw new Error('Failed to get access token from service account');
  }

  const location = 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-2.0-generate-exp:predictLongRunning`;
  
  const instance: any = {
    prompt: prompt,
    negativePrompt: "grey background, gradient background, colored background, cluttered scene, busy environment, shadows on background, dark lighting, different product, modified product, text overlays, watermarks, people, hands, multiple objects"
  };

  if (productImageData) {
    const imageDataArray = Array.isArray(productImageData) ? productImageData : [productImageData];
    
    // If only 1 image, duplicate it 3 times to give Veo 2 more confidence
    const imagesToProcess = imageDataArray.length === 1 
      ? [imageDataArray[0], imageDataArray[0], imageDataArray[0]]
      : imageDataArray;
    
    console.log(`Processing ${imagesToProcess.length} reference images for Veo 2 (${imageDataArray.length} unique)`);
    
    const referenceImages = [];
    
    for (const imgData of imagesToProcess) {
      try {
        let base64Data: string;
        
        if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
          console.log('Fetching image from URL for Veo 2:', imgData.substring(0, 50) + '...');
          const imageResponse = await fetch(imgData);
          if (!imageResponse.ok) {
            console.warn('Failed to fetch image, skipping');
            continue;
          }
          const imageBuffer = await imageResponse.arrayBuffer();
          base64Data = Buffer.from(imageBuffer).toString('base64');
        } else {
          base64Data = imgData.includes(',') ? imgData.split(',')[1] : imgData;
        }
        
        referenceImages.push({
          image: {
            bytesBase64Encoded: base64Data,
            mimeType: 'image/jpeg'
          },
          referenceType: 'asset'
        });
      } catch (err) {
        console.warn('Error processing reference image:', err);
      }
    }
    
    if (referenceImages.length > 0) {
      instance.referenceImages = referenceImages;
      console.log(`Added ${referenceImages.length} reference images to Veo 2 request`);
    }
  }
  
  const requestBody = {
    instances: [instance],
    parameters: {
      aspectRatio: '16:9',
      sampleCount: 1,
      durationSeconds: 8
    }
  };

  console.log('Calling Vertex AI Veo 2 predictLongRunning endpoint...');
  
  const veoResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!veoResponse.ok) {
    const errorText = await veoResponse.text();
    throw new Error(`Vertex AI Veo 2 API error: ${veoResponse.status} - ${errorText}`);
  }

  const operationData = await veoResponse.json();
  console.log('Veo 2 operation started:', operationData.name);
  
  const operationName = operationData.name;
  const operationEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
  
  console.log('Polling operation at:', operationEndpoint);
  
  let operationComplete = false;
  let attempts = 0;
  const maxAttempts = 60;
  
  while (!operationComplete && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
    
    const fetchOpEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-2.0-generate-exp:fetchPredictOperation`;
    
    const statusResponse = await fetch(fetchOpEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operationName: operationName
      })
    });
    
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to check operation status: ${statusResponse.status} - ${errorText}`);
    }
    
    const statusData = await statusResponse.json();
    console.log(`Veo 2 operation status check ${attempts}/${maxAttempts}:`, statusData.done ? 'Complete' : 'Processing...');
    
    if (statusData.done) {
      operationComplete = true;
      
      if (statusData.error) {
        throw new Error(`Veo 2 operation failed: ${JSON.stringify(statusData.error)}`);
      }
      
      // Log the response structure to debug
      console.log('Veo 2 operation response keys:', Object.keys(statusData.response || {}));
      console.log('Veo 2 operation response type:', statusData.response?.['@type']);
      
      // Check for video data in various possible locations
      if (statusData.response?.predictions?.[0]?.bytesBase64Encoded) {
        return {
          videoData: statusData.response.predictions[0].bytesBase64Encoded,
          mimeType: 'video/mp4'
        };
      }
      
      if (statusData.response?.videos?.[0]?.bytesBase64Encoded) {
        return {
          videoData: statusData.response.videos[0].bytesBase64Encoded,
          mimeType: statusData.response.videos[0].mimeType || 'video/mp4'
        };
      }
      
      if (statusData.response?.bytesBase64Encoded) {
        return {
          videoData: statusData.response.bytesBase64Encoded,
          mimeType: statusData.response.mimeType || 'video/mp4'
        };
      }
      
      throw new Error('Unexpected Veo 2 response structure. Response keys: ' + JSON.stringify(Object.keys(statusData.response || {})));
    }
  }
  
  if (!operationComplete) {
    throw new Error('Veo 2 operation timed out after 5 minutes');
  }
  
  throw new Error('Unexpected error in Veo 2 generation');
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // 1. Shopify Product Search Endpoint
  app.post('/api/shopify/search', async (req: Request, res: Response) => {
    try {
      const { query, searchType = 'title' } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
      const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;

      if (!shopifyStoreUrl || !shopifyAccessToken) {
        return res.status(500).json({ 
          error: 'Shopify configuration missing',
          details: 'SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN must be set'
        });
      }

      let graphqlQuery = '';
      
      if (searchType === 'title') {
        graphqlQuery = `
          query searchProducts($query: String!) {
            products(first: 20, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  productType
                  vendor
                  tags
                  images(first: 5) {
                    edges {
                      node {
                        id
                        url
                        altText
                      }
                    }
                  }
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        sku
                        price
                      }
                    }
                  }
                }
              }
            }
          }
        `;
      } else if (searchType === 'sku') {
        graphqlQuery = `
          query searchBySKU($query: String!) {
            productVariants(first: 20, query: $query) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  product {
                    id
                    title
                    handle
                    productType
                    vendor
                    images(first: 5) {
                      edges {
                        node {
                          id
                          url
                          altText
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;
      }

      const shopifyResponse = await fetch(`https://${shopifyStoreUrl}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyAccessToken,
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { query }
        }),
      });

      if (!shopifyResponse.ok) {
        throw new Error(`Shopify API error: ${shopifyResponse.status}`);
      }

      const data = await shopifyResponse.json();
      
      let products = [];
      if (searchType === 'title' && data.data?.products?.edges) {
        products = data.data.products.edges.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          productType: edge.node.productType,
          vendor: edge.node.vendor,
          tags: edge.node.tags,
          images: edge.node.images?.edges?.map((img: any) => ({
            id: img.node.id,
            url: img.node.url,
            altText: img.node.altText,
          })) || [],
          variants: edge.node.variants?.edges?.map((v: any) => ({
            id: v.node.id,
            title: v.node.title,
            sku: v.node.sku,
            price: v.node.price,
          })) || [],
        }));
      } else if (searchType === 'sku' && data.data?.productVariants?.edges) {
        products = data.data.productVariants.edges.map((edge: any) => ({
          id: edge.node.product.id,
          title: edge.node.product.title,
          handle: edge.node.product.handle,
          productType: edge.node.product.productType,
          vendor: edge.node.product.vendor,
          images: edge.node.product.images?.edges?.map((img: any) => ({
            id: img.node.id,
            url: img.node.url,
            altText: img.node.altText,
          })) || [],
          variants: [{
            id: edge.node.id,
            title: edge.node.title,
            sku: edge.node.sku,
            price: edge.node.price,
          }],
        }));
      }

      res.json({ products });
    } catch (error) {
      console.error('Shopify search error:', error);
      res.status(500).json({ 
        error: 'Failed to search Shopify products',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 2. ImageKit Upload Endpoint
  app.post('/api/imagekit/upload', async (req: Request, res: Response) => {
    try {
      const { imageData, fileName = 'product-image.jpg' } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const imagekitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;

      if (!imagekitPrivateKey) {
        return res.status(500).json({ 
          error: 'ImageKit configuration missing',
          details: 'IMAGEKIT_PRIVATE_KEY must be set for server-side upload'
        });
      }

      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;

      // Create FormData for multipart/form-data upload
      const formData = new FormData();
      formData.append('file', base64Data);
      formData.append('fileName', fileName);

      const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString('base64')}`,
          ...formData.getHeaders(),
        },
        body: formData as any,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`ImageKit upload failed: ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      
      res.json({
        success: true,
        url: uploadData.url,
        fileId: uploadData.fileId,
        name: uploadData.name,
      });
    } catch (error) {
      console.error('ImageKit upload error:', error);
      res.status(500).json({ 
        error: 'Failed to upload to ImageKit',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 3. Gemini Image Analysis Endpoint
  app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
    try {
      const { imageData, productName = 'Product' } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      }

      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Data
                  }
                },
                {
                  text: `Analyze this ${productName} image and create a detailed description for 360-degree video generation. Focus on: product type, key features, materials, colors, textures, and visual characteristics. Be specific and descriptive for AI video generation.`
                }
              ]
            }]
          })
        }
      );

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();
      
      if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid Gemini response');
      }

      const description = geminiData.candidates[0].content.parts[0].text;
      
      const videoPrompt = `Create a professional 360-degree rotating product video showcasing this ${productName}. ${description}. The video should feature smooth rotation, professional lighting, clean background, and highlight all key features and details of the product. Style: Product photography, commercial quality, 8-10 seconds duration.`;

      res.json({
        success: true,
        description,
        videoPrompt,
      });
    } catch (error) {
      console.error('Gemini analysis error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze image with Gemini',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 4. Gemini Veo Video Generation Endpoint
  app.post('/api/gemini/generate-video', async (req: Request, res: Response) => {
    try {
      const { prompt, productName = 'Product' } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Video prompt is required' });
      }

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      }

      const veoResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              response_modalities: ['VIDEO'],
              media_resolution: 'MEDIUM'
            }
          })
        }
      );

      if (!veoResponse.ok) {
        const errorText = await veoResponse.text();
        throw new Error(`Gemini Veo API error: ${veoResponse.status} - ${errorText}`);
      }

      const veoData = await veoResponse.json();
      
      if (veoData.candidates?.[0]?.content?.parts?.[0]?.inline_data) {
        const videoData = veoData.candidates[0].content.parts[0].inline_data.data;
        const mimeType = veoData.candidates[0].content.parts[0].inline_data.mime_type || 'video/mp4';
        
        const videoBuffer = Buffer.from(videoData, 'base64');
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${productName.replace(/[^a-z0-9]/gi, '_')}_360_video.mp4"`);
        res.setHeader('Content-Length', videoBuffer.length);
        res.send(videoBuffer);
      } else {
        res.status(500).json({ 
          error: 'Video generation failed',
          details: 'No video data in response',
          response: veoData
        });
      }
    } catch (error) {
      console.error('Gemini Veo generation error:', error);
      res.status(500).json({ 
        error: 'Failed to generate video with Gemini Veo',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 5. Complete Workflow Endpoint (All-in-One)
  app.post('/api/generate-360-video', async (req: Request, res: Response) => {
    try {
      const { imageData, additionalImages = [], productName = 'Product', shopifyProductId } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const jobId = crypto.randomUUID();
      console.log(`[${jobId}] Starting 360° video generation for: ${productName}`);
      console.log(`[${jobId}] Main image + ${additionalImages.length} additional angle(s)`);

      const videoGen = await storage.createVideoGeneration({
        productName,
        imageUrl: imageData,
        status: 'pending',
      });

      await storage.updateVideoGeneration(videoGen.id, { status: 'analyzing' });
      console.log(`[${jobId}] Step 1: Uploading images to ImageKit...`);
      
      let imageToAnalyze = imageData;
      const allImageUrls: string[] = [];
      
      try {
        const imagekitData = await uploadToImageKit(
          imageData,
          `${productName.replace(/[^a-z0-9]/gi, '_')}_main_${Date.now()}.jpg`
        );
        imageToAnalyze = imagekitData.url;
        allImageUrls.push(imagekitData.url);
        await storage.updateVideoGeneration(videoGen.id, { imagekitUrl: imagekitData.url });
        console.log(`[${jobId}] Main image upload successful: ${imagekitData.url}`);
      } catch (err) {
        console.warn(`[${jobId}] ImageKit upload failed for main image, using original:`, err);
        allImageUrls.push(imageData);
      }

      // Upload additional images
      for (let i = 0; i < additionalImages.length; i++) {
        try {
          const additionalData = await uploadToImageKit(
            additionalImages[i],
            `${productName.replace(/[^a-z0-9]/gi, '_')}_angle${i + 1}_${Date.now()}.jpg`
          );
          allImageUrls.push(additionalData.url);
          console.log(`[${jobId}] Additional image ${i + 1} upload successful: ${additionalData.url}`);
        } catch (err) {
          console.warn(`[${jobId}] ImageKit upload failed for additional image ${i + 1}, using original:`, err);
          allImageUrls.push(additionalImages[i]);
        }
      }

      console.log(`[${jobId}] Step 2: Analyzing image with Gemini...`);
      const analysisData = await analyzeImageWithGemini(imageToAnalyze, productName);
      
      await storage.updateVideoGeneration(videoGen.id, {
        geminiDescription: analysisData.description,
        videoPrompt: analysisData.videoPrompt,
        status: 'generating',
      });
      console.log(`[${jobId}] Image analysis complete`);

      console.log(`[${jobId}] Step 3: Generating 360° video with Vertex AI Veo 2...`);
      console.log(`[${jobId}] Sending ${allImageUrls.length} reference image(s) to Veo 2`);
      const { videoData, mimeType } = await generateVideoWithVertexAI(
        analysisData.videoPrompt,
        productName,
        allImageUrls
      );

      const videoBuffer = Buffer.from(videoData, 'base64');

      await storage.updateVideoGeneration(videoGen.id, {
        videoData: videoData,
        status: 'completed',
      });

      console.log(`[${jobId}] ✅ Video generation completed successfully`);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${productName.replace(/[^a-z0-9]/gi, '_')}_360_video.mp4"`);
      res.setHeader('Content-Length', videoBuffer.length);
      res.send(videoBuffer);

    } catch (error) {
      console.error('Complete workflow error:', error);
      res.status(500).json({ 
        error: 'Video generation workflow failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 6. Get Video Generation Status
  app.get('/api/video-generation/:id', async (req: Request, res: Response) => {
    try {
      const videoGen = await storage.getVideoGeneration(req.params.id);
      
      if (!videoGen) {
        return res.status(404).json({ error: 'Video generation not found' });
      }

      res.json(videoGen);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch video generation' });
    }
  });

  // 7. List All Video Generations
  app.get('/api/video-generations', async (req: Request, res: Response) => {
    try {
      const generations = await storage.listVideoGenerations();
      res.json({ generations });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch video generations' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
