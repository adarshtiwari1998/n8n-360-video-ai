import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enhanced API route to generate 360° videos with detailed n8n workflow tracking
  app.post('/api/generate-video', async (req, res) => {
    const startTime = Date.now();
    const sessionId = `session_${startTime}`;
    
    try {
      const { image_data, product_name } = req.body;
      
      if (!image_data) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Step 1: Log workflow initiation
      console.log(`\n🚀 [${sessionId}] === 360° VIDEO GENERATION STARTED ===`);
      console.log(`📸 [${sessionId}] Product: ${product_name || 'Unnamed Product'}`);
      console.log(`📊 [${sessionId}] Image size: ${Math.round((image_data.length * 0.75) / 1024)} KB`);
      console.log(`🔗 [${sessionId}] Step 1: Triggering n8n webhook...`);

      // Step 2: Call n8n webhook
      const n8nResponse = await fetch('https://n8n-360-video-ai.onrender.com/webhook/create-360-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: {
            image_url: image_data,
            product_name: product_name || 'Product',
            session_id: sessionId
          }
        }),
      });

      console.log(`✅ [${sessionId}] Step 2: Webhook response status: ${n8nResponse.status}`);

      if (!n8nResponse.ok) {
        console.log(`❌ [${sessionId}] n8n webhook failed with status: ${n8nResponse.status}`);
        throw new Error(`n8n request failed: ${n8nResponse.status}`);
      }

      // Step 3: Process response
      const contentType = n8nResponse.headers.get('content-type');
      console.log(`📋 [${sessionId}] Step 3: Response content-type: ${contentType}`);
      
      if (contentType?.includes('video/')) {
        // Video content received - workflow completed successfully
        console.log(`🎬 [${sessionId}] Step 4: Video content received, streaming to client...`);
        
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="360_video_${Date.now()}.mp4"`);
        
        let totalBytes = 0;
        const reader = n8nResponse.body?.getReader();
        
        if (reader) {
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                totalBytes += value.length;
                res.write(value);
              }
              
              const duration = Date.now() - startTime;
              console.log(`✅ [${sessionId}] === VIDEO GENERATION COMPLETED ===`);
              console.log(`📊 [${sessionId}] Final video size: ${Math.round(totalBytes / 1024)} KB`);
              console.log(`⏱️  [${sessionId}] Total time: ${duration}ms`);
              console.log(`🎉 [${sessionId}] All workflow steps completed successfully!\n`);
              
              res.end();
            } catch (error) {
              console.log(`❌ [${sessionId}] Error streaming video: ${error}`);
              res.status(500).end();
            }
          };
          pump();
        } else {
          console.log(`❌ [${sessionId}] No video data received from n8n`);
          res.status(500).json({ error: 'No video data received' });
        }
      } else {
        // JSON response (might be status or error)
        const jsonData = await n8nResponse.json();
        console.log(`📄 [${sessionId}] Step 4: JSON response received:`, jsonData);
        
        if (jsonData.error) {
          console.log(`❌ [${sessionId}] n8n workflow error:`, jsonData);
        } else {
          console.log(`ℹ️  [${sessionId}] n8n workflow status:`, jsonData);
        }
        
        res.json(jsonData);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ [${sessionId}] === VIDEO GENERATION FAILED ===`);
      console.log(`💥 [${sessionId}] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`⏱️  [${sessionId}] Failed after: ${duration}ms\n`);
      
      res.status(500).json({ 
        error: 'Video generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        session_id: sessionId
      });
    }
  });

  // New endpoint to check n8n workflow status
  app.get('/api/workflow-status/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
      // This endpoint can be used to check the status of long-running workflows
      console.log(`🔍 [${sessionId}] Checking workflow status...`);
      
      res.json({
        session_id: sessionId,
        status: 'checking',
        message: 'Workflow status check - implement with n8n execution API if needed'
      });
    } catch (error) {
      res.status(500).json({ error: 'Status check failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
