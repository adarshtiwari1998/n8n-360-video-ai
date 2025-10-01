# 360° Product Video AI Generator Platform

## Overview

This is a web-based platform that generates 360-degree product videos from static images using AI automation. The application leverages a multi-step workflow combining GLM-4.5 for product analysis, prompt generation for video creation, and Gemini Veo3 for the actual video synthesis. Built with a modern tech stack featuring React TypeScript frontend, Express.js backend, and integration with external n8n workflows for AI processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18 + TypeScript**: Modern component-based UI with strict type safety
- **Vite**: Fast development build tool with hot module replacement
- **Tailwind CSS**: Utility-first styling with custom design system
- **Shadcn/ui Components**: Consistent, accessible UI component library using Radix UI primitives
- **TanStack Query**: Server state management and data fetching with caching
- **React Hook Form**: Form validation and management
- **Wouter**: Lightweight client-side routing

### Backend Architecture
- **Express.js**: RESTful API server with middleware for request processing
- **TypeScript**: End-to-end type safety across the application
- **Drizzle ORM**: Type-safe database operations with PostgreSQL
- **Session Management**: PostgreSQL session storage for user state

### Database Design
- **PostgreSQL**: Primary database using Neon serverless infrastructure
- **Drizzle Schema**: User management tables with UUID primary keys
- **Migration System**: Version-controlled database schema evolution

### AI Workflow Integration
- **n8n Webhook Integration**: External workflow automation platform for AI processing
- **GLM-4.5 API**: Product image analysis and description generation
- **Gemini Veo3**: 360-degree video generation from prompts
- **Multi-step Processing**: Webhook → Image Analysis → Prompt Generation → Video Creation → Processing → Completion

### Design System
- **Dark/Light Mode**: CSS custom properties for theme switching
- **Color Palette**: Modern purple accent (260° 85% 65%) with neutral backgrounds
- **Typography**: Inter font family for technical readability
- **Component Variants**: Class variance authority for consistent component styling
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

### File Upload & Processing
- **Base64 Image Handling**: Client-side image encoding with 8MB size limits
- **Progress Tracking**: Real-time workflow status updates across 6 distinct phases
- **Error Handling**: Comprehensive error states with user-friendly messaging

### External Dependencies
- **n8n Workflow Platform**: Hosted automation workflows for AI processing
- **Neon Database**: Serverless PostgreSQL hosting
- **Google Fonts**: Inter and JetBrains Mono font loading
- **Replit Development**: Development environment integration

### State Management
- **Client State**: React useState for UI state and form management
- **Server State**: TanStack Query for API data caching and synchronization
- **Session State**: Express sessions with PostgreSQL storage
- **File State**: Memory-based file handling with cleanup

## Replit Setup & Troubleshooting

### Initial Setup from GitHub Import

If you import this project from GitHub to Replit and encounter the `tsx: not found` error, follow these steps:

#### Problem
When `NODE_ENV=production` is set in the environment, npm will NOT install devDependencies (which includes tsx, vite, typescript, esbuild, and other build tools). This causes the application to fail with errors like:
- `sh: 1: tsx: not found`
- `Cannot find module 'vite'`
- Missing TypeScript compiler

#### Solution
1. **Unset NODE_ENV and reinstall dependencies:**
   ```bash
   unset NODE_ENV && npm install
   ```

2. **Verify tsx is installed:**
   ```bash
   ls node_modules/.bin/tsx
   ```
   You should see a symlink to the tsx executable.

3. **Update package.json dev script (if needed):**
   The dev script should use `npx tsx` to ensure tsx is found:
   ```json
   "dev": "NODE_ENV=development PORT=5000 npx tsx server/index.ts"
   ```

4. **Restart the workflow:**
   The "Start application" workflow should now start successfully on port 5000.

#### Why This Happens
- Replit may set `NODE_ENV=production` by default in some cases
- When `NODE_ENV=production`, npm skips installing devDependencies as an optimization
- This project requires devDependencies (tsx, vite, etc.) even in development mode
- The solution is to explicitly unset NODE_ENV before running npm install

#### Verification Checklist
After setup, verify:
- [ ] Server runs on port 5000 without errors
- [ ] Vite dev server connects successfully
- [ ] Frontend loads in the browser
- [ ] All devDependencies are present in node_modules
- [ ] tsx, vite, typescript, esbuild binaries exist in node_modules/.bin/

### Vertex AI Veo 3 Quota Setup

**Important:** Veo video generation models require quota allocation in Google Cloud Platform.

#### Initial Quota Issue
By default, Veo models have **0 quota** which causes this error:
```
Quota exceeded for aiplatform.googleapis.com/online_prediction_requests_per_base_model 
with base model: veo-3.0-generate-001
```

#### Solution: Request Quota Increase
1. Go to **GCP Console → IAM & Admin → Quotas**
2. Filter for: `base_model:veo-3.0-generate-001`
3. Select the quota for region `us-central1`
4. Click **EDIT** and request increase (e.g., 10 requests)
5. Submit the request and wait for approval (usually within hours)

#### Current Setup
- **Model**: `veo-3.0-generate-001` (Veo 3)
- **Region**: `us-central1`
- **Quota**: 10 requests (configured)
- **Authentication**: Service account via `credentials.json`

### Development Workflow
- **Port Configuration**: Frontend and backend both run on port 5000 (Vite dev server in middleware mode)
- **Hot Reload**: Vite provides instant HMR for frontend changes
- **TypeScript**: tsx provides instant TypeScript execution for backend
- **Environment Variables**: Store API keys in Replit Secrets (GEMINI_API_KEY, SHOPIFY credentials, etc.)
- **Veo 2 Authentication**: Uses service account from `credentials.json` (already configured)

## Recent Changes (October 2025)

### Image Conditioning for Veo 2 - 100% Product Accuracy

**Issue Fixed:** Generated 360° videos were not matching the actual product image 100%. The video showed similar but not identical products because Veo 2 was only receiving text prompts without the actual product image.

**Solution Implemented:**
1. **ImageKit Upload Fix**: Fixed FormData compatibility issue by using Node.js https module instead of fetch API for multipart/form-data uploads
2. **Veo 2 Image Conditioning**: Updated `generateVideoWithVertexAI()` to accept product image as `referenceImages` parameter in the API request
3. **Workflow Integration**: Modified the complete video generation workflow to pass the actual product image to Veo 2

**Technical Details:**
- Veo 2 now receives the product image as a base64-encoded `referenceImage` with `referenceType: 'asset'`
- The image is fetched from either URL or base64 data and included in the Veo 2 API request body
- This ensures the generated 360° video features the exact same product, not a similar approximation

**API Structure:**
```json
{
  "instances": [{
    "prompt": "Create a professional 360-degree rotating product video...",
    "referenceImages": [{
      "image": {
        "bytesBase64Encoded": "base64_image_data",
        "mimeType": "image/jpeg"
      },
      "referenceType": "asset"
    }]
  }],
  "parameters": {
    "aspectRatio": "16:9",
    "sampleCount": 1,
    "durationSeconds": 8
  }
}
```