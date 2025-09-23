# Design Guidelines: 360° Product Video AI Generator Platform

## Design Approach
**Reference-Based Approach**: Drawing inspiration from productivity and AI tools like Notion, Linear, and RunwayML's interface. This platform balances technical functionality with modern visual appeal, targeting users who need powerful automation tools with an intuitive interface.

## Core Design Elements

### A. Color Palette
**Primary Colors:**
- Dark mode primary: 220 85% 8% (Deep navy background)
- Light mode primary: 220 20% 98% (Clean white background)
- Accent: 260 85% 65% (Modern purple for AI/tech branding)
- Success: 142 70% 45% (Green for completed workflows)
- Warning: 45 90% 60% (Amber for processing states)

**Supporting Colors:**
- Text primary: 220 15% 95% (dark mode) / 220 15% 15% (light mode)
- Text secondary: 220 10% 70% (dark mode) / 220 10% 50% (light mode)
- Border: 220 20% 20% (dark mode) / 220 20% 90% (light mode)

### B. Typography
**Font System:**
- Primary: Inter (via Google Fonts CDN) - clean, technical readability
- Headings: Inter 600-700 weight
- Body: Inter 400-500 weight
- Code/Technical: JetBrains Mono 400 weight

**Scale:**
- Hero headline: text-4xl (36px)
- Section headers: text-2xl (24px)
- Component labels: text-sm (14px)
- Body text: text-base (16px)

### C. Layout System
**Spacing Primitives:** Use Tailwind units of 4, 8, 12, and 16 for consistent rhythm
- Component padding: p-4, p-8
- Section margins: m-8, m-12
- Grid gaps: gap-4, gap-8
- Container max-width: max-w-6xl with mx-auto centering

### D. Component Library

**Core UI Elements:**
- **Dashboard Cards:** Clean white/dark containers with subtle shadows and rounded corners (rounded-lg)
- **Status Indicators:** Circular badges with color-coded states (processing, complete, error)
- **Progress Bars:** Linear progress with smooth animations for video generation
- **Input Fields:** Consistent border styling with focus states using accent color

**Navigation:**
- **Sidebar Navigation:** Fixed left panel with workflow categories and recent activities
- **Top Bar:** Breadcrumb navigation with user account controls
- **Workflow Builder:** Node-based visual interface with connection lines

**Forms & Controls:**
- **File Upload:** Drag-and-drop zones with visual feedback
- **Parameter Controls:** Slider inputs for rotation speed, duration, quality settings
- **API Configuration:** Tabbed interface for different service credentials

**Data Displays:**
- **Workflow History:** Timeline view of recent generations
- **Video Gallery:** Grid layout with thumbnail previews
- **Execution Logs:** Expandable accordion panels with detailed status

**Overlays:**
- **Modal Dialogs:** For workflow configuration and settings
- **Toast Notifications:** Slide-in alerts for operation status
- **Loading States:** Skeleton screens during AI processing

### E. Animations
**Minimal Animation Strategy:**
- Smooth transitions (300ms ease-in-out) for state changes only
- Subtle hover effects on interactive elements
- Progress indicators with gentle pulsing for active processes
- No decorative animations to maintain professional focus

## Marketing/Landing Page Design

### Visual Treatment
**Color Strategy:**
- Hero gradient: 260 85% 65% to 220 85% 45% (Purple to blue gradient for AI sophistication)
- Background: Clean white with subtle gradient overlays
- Accent sparingly: Use purple accent only for primary CTAs

**Gradient Applications:**
- Hero background: Subtle diagonal gradient overlay
- Feature cards: Gentle gradient borders
- CTA buttons: Solid accent color with slight gradient hover state

### Content Structure (Maximum 4 Sections)

**1. Hero Section:**
- Large headline: "Transform Product Photos into 360° Videos with AI"
- Subheadline: "Automated workflow platform using n8n and leading AI services"
- Primary CTA: "Start Free Trial"
- Hero visual: Screenshot of the workflow interface with sample 360° video preview

**2. Core Value Proposition:**
- Three-column feature grid highlighting automation, AI integration, and professional output
- Visual: Before/after comparison showing single image → 360° video

**3. Technical Capabilities:**
- Integration showcase: Logos of n8n, OpenAI, RunwayML, Render
- Workflow diagram: Simple visual showing the automated process flow

**4. CTA Section:**
- Simple sign-up form with email input
- Secondary CTA: "View Documentation"
- Background: Subtle gradient overlay

### Key Design Principles
- **Professional Authority:** Clean, technical aesthetic that builds trust
- **Workflow Clarity:** Visual hierarchy that guides users through complex processes
- **Status Transparency:** Clear feedback at every step of video generation
- **Scalable Interface:** Design accommodates both single video and batch processing workflows

This design balances the technical complexity of AI automation with an approachable, modern interface that professionals expect from productivity tools.