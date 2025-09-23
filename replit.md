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