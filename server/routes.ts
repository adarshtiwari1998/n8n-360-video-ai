import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // API route to generate 360° videos (proxy to n8n to avoid CORS)
  app.post('/api/generate-video', async (req, res) => {
    try {
      const { image_data, product_name } = req.body;
      
      if (!image_data) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Proxy request to n8n webhook to avoid CORS issues
      const n8nResponse = await fetch('https://n8n-360-video-ai.onrender.com/webhook/23of1hL5JeJ12On', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: image_data,
          product_name: product_name || 'Product'
        }),
      });

      if (!n8nResponse.ok) {
        throw new Error(`n8n request failed: ${n8nResponse.status}`);
      }

      // Check if response is video content
      const contentType = n8nResponse.headers.get('content-type');
      if (contentType?.includes('video/')) {
        // Stream video response back to client
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="360_video_${Date.now()}.mp4"`);
        
        // Convert web stream to node stream
        const reader = n8nResponse.body?.getReader();
        if (reader) {
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              res.end();
            } catch (error) {
              res.status(500).end();
            }
          };
          pump();
        } else {
          res.status(500).json({ error: 'No video data received' });
        }
      } else {
        // Handle JSON response (might be status or error)
        const jsonData = await n8nResponse.json();
        res.json(jsonData);
      }

    } catch (error) {
      console.error('Video generation error:', error);
      res.status(500).json({ 
        error: 'Video generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
