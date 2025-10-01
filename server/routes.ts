import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { shopifyProductSchema } from "@shared/schema";
import crypto from "crypto";
import { GoogleAuth } from 'google-auth-library';
import FormData from 'form-data';

async function uploadToImageKit(imageData: string, fileName: string) {
  const imagekitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!imagekitPrivateKey) {
    throw new Error('ImageKit IMAGEKIT_PRIVATE_KEY not configured');
  }

  // Check if imageData is a URL or base64
  const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
  
  let base64Data: string;
  if (isUrl) {
    // ImageKit requires base64 for server-side uploads, so fetch and convert
    console.log('Fetching image from URL for ImageKit upload:', imageData);
    const imageResponse = await fetch(imageData);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    base64Data = Buffer.from(imageBuffer).toString('base64');
  } else {
    // It's already base64, just clean it up
    base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
  }

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('fileName', fileName);
  formData.append('useUniqueFileName', 'true');

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

  return await uploadResponse.json();
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
  
  const videoPrompt = `Create a professional 360-degree rotating product video showcasing this ${productName}. ${description}. The video should feature smooth rotation, professional lighting, clean background, and highlight all key features and details of the product. Style: Product photography, commercial quality, 8-10 seconds duration.`;

  return { description, videoPrompt };
}

async function generateVideoWithVertexAI(prompt: string, productName: string) {
  const serviceAccountJson = process.env.VERTEX_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.VERTEX_PROJECT_ID;
  
  if (!serviceAccountJson) {
    throw new Error('VERTEX_SERVICE_ACCOUNT_JSON not configured. Please add your service account JSON to Replit Secrets.');
  }

  if (!projectId) {
    throw new Error('VERTEX_PROJECT_ID not configured');
  }

  console.log('Generating video with Vertex AI Veo 2...');
  
  // Parse the service account JSON - clean it first
  let credentials;
  try {
    // Remove any potential whitespace or newlines that might break JSON
    const cleanedJson = serviceAccountJson.trim();
    credentials = JSON.parse(cleanedJson);
  } catch (parseError) {
    console.error('Failed to parse VERTEX_SERVICE_ACCOUNT_JSON:', parseError);
    throw new Error('Invalid VERTEX_SERVICE_ACCOUNT_JSON format. Please ensure it is valid JSON without extra characters.');
  }
  
  // Create GoogleAuth client with service account credentials
  const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  // Get access token from service account
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  
  if (!accessToken.token) {
    throw new Error('Failed to get access token from service account');
  }

  const location = 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-2.0-generate-001:predict`;
  
  const requestBody = {
    instances: [{
      prompt: prompt
    }],
    parameters: {
      aspectRatio: '16:9',
      duration: 8,
      responseCount: 1
    }
  };

  console.log('Calling Vertex AI Veo 2 endpoint...');
  
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

  const veoData = await veoResponse.json();
  console.log('Veo 2 response received');
  
  // Vertex AI returns an operation that needs to be polled
  if (veoData.name || veoData.predictions?.[0]?.videoUri) {
    // Check if we have direct video data or need to poll
    if (veoData.predictions?.[0]?.video) {
      // Direct video data (base64)
      return {
        videoData: veoData.predictions[0].video,
        mimeType: 'video/mp4'
      };
    }
    
    if (veoData.predictions?.[0]?.videoUri) {
      // Video is at a URI - download it
      const videoUri = veoData.predictions[0].videoUri;
      console.log('Downloading video from URI:', videoUri);
      
      const videoResponse = await fetch(videoUri, {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`
        }
      });
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      
      const videoBuffer = await videoResponse.arrayBuffer();
      const videoData = Buffer.from(videoBuffer).toString('base64');
      
      return {
        videoData: videoData,
        mimeType: 'video/mp4'
      };
    }
    
    // Operation-based response - poll for completion
    if (veoData.name) {
      const operationName = veoData.name;
      console.log('Video generation started, operation:', operationName);
      
      // Poll for completion
      const maxAttempts = 40; // 40 * 5 seconds = ~3 minutes
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const statusResponse = await fetch(
          `https://${location}-aiplatform.googleapis.com/v1/${operationName}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!statusResponse.ok) {
          throw new Error(`Failed to check status: ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.done) {
          if (statusData.error) {
            throw new Error(`Video generation failed: ${JSON.stringify(statusData.error)}`);
          }
          
          if (statusData.response?.predictions?.[0]?.video) {
            return {
              videoData: statusData.response.predictions[0].video,
              mimeType: 'video/mp4'
            };
          }
          
          if (statusData.response?.predictions?.[0]?.videoUri) {
            const videoUri = statusData.response.predictions[0].videoUri;
            const videoResponse = await fetch(videoUri, {
              headers: { 'Authorization': `Bearer ${accessToken.token}` }
            });
            const videoBuffer = await videoResponse.arrayBuffer();
            return {
              videoData: Buffer.from(videoBuffer).toString('base64'),
              mimeType: 'video/mp4'
            };
          }
        }
        
        console.log(`Video generation in progress... (${i + 1}/${maxAttempts})`);
      }
      
      throw new Error('Video generation timed out');
    }
  }
  
  throw new Error('Unexpected Vertex AI response: ' + JSON.stringify(veoData));
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
      const { imageData, productName = 'Product', shopifyProductId } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const jobId = crypto.randomUUID();
      console.log(`[${jobId}] Starting 360° video generation for: ${productName}`);

      const videoGen = await storage.createVideoGeneration({
        productName,
        imageUrl: imageData,
        status: 'pending',
      });

      await storage.updateVideoGeneration(videoGen.id, { status: 'analyzing' });
      console.log(`[${jobId}] Step 1: Uploading to ImageKit...`);
      
      let imageToAnalyze = imageData;
      try {
        const imagekitData = await uploadToImageKit(
          imageData,
          `${productName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`
        );
        imageToAnalyze = imagekitData.url;
        await storage.updateVideoGeneration(videoGen.id, { imagekitUrl: imagekitData.url });
        console.log(`[${jobId}] ImageKit upload successful: ${imagekitData.url}`);
      } catch (err) {
        console.warn(`[${jobId}] ImageKit upload failed, using original image:`, err);
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
      const { videoData, mimeType } = await generateVideoWithVertexAI(
        analysisData.videoPrompt,
        productName
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
