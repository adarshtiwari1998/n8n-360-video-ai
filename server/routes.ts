import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { shopifyProductSchema } from "@shared/schema";
import crypto from "crypto";

async function uploadToImageKit(imageData: string, fileName: string) {
  const imagekitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const imagekitPublicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const imagekitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!imagekitPrivateKey || !imagekitPublicKey || !imagekitUrlEndpoint) {
    throw new Error('ImageKit configuration missing');
  }

  // Check if imageData is a URL or base64
  const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
  
  let uploadBody: any;
  if (isUrl) {
    // Upload from URL
    uploadBody = {
      file: imageData,
      fileName: fileName,
      useUniqueFileName: false,
    };
  } else {
    // Upload from base64
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    uploadBody = {
      file: base64Data,
      fileName: fileName,
      useUniqueFileName: false,
    };
  }

  const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString('base64')}`
    },
    body: JSON.stringify(uploadBody),
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

async function generateVideoWithGemini(prompt: string, productName: string) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
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
  
  if (!veoData.candidates?.[0]?.content?.parts?.[0]?.inline_data) {
    throw new Error('No video data in response');
  }

  const videoData = veoData.candidates[0].content.parts[0].inline_data.data;
  const mimeType = veoData.candidates[0].content.parts[0].inline_data.mime_type || 'video/mp4';
  
  return { videoData, mimeType };
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
      const imagekitPublicKey = process.env.IMAGEKIT_PUBLIC_KEY;
      const imagekitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

      if (!imagekitPrivateKey || !imagekitPublicKey || !imagekitUrlEndpoint) {
        return res.status(500).json({ 
          error: 'ImageKit configuration missing',
          details: 'IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_URL_ENDPOINT must be set'
        });
      }

      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;

      const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString('base64')}`
        },
        body: JSON.stringify({
          file: base64Data,
          fileName: fileName,
          publicKey: imagekitPublicKey,
        }),
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

      console.log(`[${jobId}] Step 3: Generating 360° video with Gemini Veo...`);
      const { videoData, mimeType } = await generateVideoWithGemini(
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
