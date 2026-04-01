# EverForge 3D — AI-Powered 3D Website Generator

Generate cinematic, scroll-driven 3D websites from a single prompt. Powered by a multi-agent AI system using AWS Bedrock (Claude + Stable Diffusion).

## Architecture

```
User Prompt + Optional URL/Image
        |
        v
  ┌─────────────────────────────────────────────┐
  │           Multi-Agent Backend                │
  │                                              │
  │  Style Extractor  (Playwright → DOM styles)  │
  │  Content Analyst  (Claude → brand strategy)  │
  │  Color Architect  (Claude → palette design)  │
  │  Cinematic Director (Claude → camera angles) │
  │  Page Architect   (Claude → sections + copy) │
  │  Image Generator  (SD 3.5 → frame images)   │
  └─────────────────────────────────────────────┘
        |
        v
  React + Three.js + Tailwind Frontend
  ├── 3D Hero (scroll-driven frame crossfade)
  ├── Header, Features, Stats, Showcase
  ├── Testimonials, CTA, Footer
  └── Export to standalone HTML
```

## Prerequisites

- **Node.js 22+**
- **AWS Account** with Bedrock access
- **AWS SSO** configured with a profile that has Bedrock permissions
- **Chromium** installed for Playwright (auto-installed on first run)

### Bedrock Models Required

Enable these in your AWS Bedrock console:

| Model | Purpose |
|-------|---------|
| Claude Sonnet 4.5 | Prompt generation, page planning, content analysis |
| Stability SD 3.5 Large | Image/frame generation |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/vaibhaw-gebra/3dPageGeneration.git
cd 3dPageGeneration
npm install
npx playwright install chromium
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your AWS settings:

```env
# AWS Bedrock (uses SSO profile-based auth)
VITE_AWS_REGION=us-west-2
VITE_AWS_PROFILE=YourProfileName

# Bedrock Models
VITE_BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
VITE_BEDROCK_IMAGE_MODEL_ID=stability.sd3-5-large-v1:0

# Optional: if image model is in a different region
# VITE_BEDROCK_IMAGE_REGION=us-east-1
```

### 3. Authenticate with AWS

```bash
aws sso login --profile YourProfileName
```

### 4. Start the server and frontend

Terminal 1 — Backend (port 3001):
```bash
npm run server
```

Terminal 2 — Frontend (port 3000):
```bash
npm run dev
```

Or both at once:
```bash
npm start
```

Open http://localhost:3000

## Usage

### Basic Flow

1. Click **Start Building** on the landing page
2. Type a scene description, e.g.: *"A futuristic robot product showcase with neon lighting and a dark studio environment"*
3. Optionally attach a **reference image** (paperclip icon) or **reference URL** (link icon)
4. The pipeline runs through 5 agents, pausing at each stage for your approval
5. Preview the generated site on the right panel
6. Send follow-up prompts to refine (only regenerates the layout, keeps frames)
7. Click **Export HTML** to download a standalone file

### Reference URL

Click the link icon next to the chat input to add a website URL. The system will:
- Launch Playwright to screenshot and analyze the site's DOM
- Extract colors, fonts, sections, and spacing
- Run Content Analyst and Color Architect agents in parallel
- Use all extracted data to match the reference site's visual style

### Approval Gates

The pipeline pauses 3 times for your approval:
1. **After camera angles** — review the planned angles before image generation
2. **After frames** — review generated images before page layout
3. **After page plan** — review sections and copy before final assembly

Click **Approve & Continue** or **Stop** to modify your prompt.

## Project Structure

```
├── server/                     # Express backend (port 3001)
│   ├── index.ts                # API routes + server setup
│   ├── llm.ts                  # Shared Bedrock Claude client
│   └── agents/
│       ├── style-extractor.ts  # Playwright DOM analysis
│       ├── content-analyst.ts  # Brand/audience strategy
│       ├── color-architect.ts  # Color palette design
│       ├── cinematic-director.ts # Camera angle prompts
│       └── page-architect.ts   # Page layout + copy
│
├── src/                        # React frontend (port 3000)
│   ├── api/bedrock.ts          # API client (calls backend)
│   ├── pipeline/
│   │   └── frame-generator.ts  # Pipeline orchestrator + approval gates
│   ├── components/
│   │   ├── 3d/ScrollScene.tsx  # Three.js scroll-driven frame renderer
│   │   ├── LandingPage.tsx     # Draggable node canvas landing page
│   │   ├── PageRenderer.tsx    # Assembles header + hero(3D) + sections
│   │   ├── sections/           # 8 section components (header → footer)
│   │   └── ui/                 # Chat panel, pipeline view, resize handle
│   ├── export/html-export.ts   # Standalone HTML export
│   └── types/index.ts          # TypeScript types
│
├── .env.example                # Environment template
├── package.json
├── vite.config.ts              # Vite + Tailwind + proxy to backend
└── tsconfig.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite frontend (port 3000) |
| `npm run server` | Start Express backend (port 3001) |
| `npm start` | Start both (backend + frontend) |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite |
| 3D Rendering | Three.js, React Three Fiber, custom GLSL shaders |
| State | React hooks (no external state library) |
| Backend | Express 5, TypeScript, tsx runner |
| AI Models | AWS Bedrock (Claude Sonnet 4.5, Stable Diffusion 3.5) |
| Extraction | Playwright (headless Chromium) |
| Auth | AWS SSO (profile-based credentials) |

## Supported Image Models

Configure via `VITE_BEDROCK_IMAGE_MODEL_ID` in `.env`:

| Model ID | Name |
|----------|------|
| `stability.sd3-5-large-v1:0` | Stable Diffusion 3.5 Large (recommended) |
| `amazon.nova-canvas-v1:0` | Amazon Nova Canvas |
| `amazon.titan-image-generator-v2:0` | Amazon Titan Image v2 |

> Note: Model availability varies by AWS region. Check your Bedrock console.
