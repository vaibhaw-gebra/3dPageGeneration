// Frame generation types

export interface FramePrompt {
  index: number;
  angle: string; // e.g., "front", "left-pan-15", "right-pan-15", "top-tilt-10"
  zoom: "wide" | "medium" | "close";
  mood: string; // e.g., "bright", "dramatic", "warm", "cool"
  prompt: string; // Full text prompt for image generation
  cameraPosition?: { x: number; y: number; z: number };
}

export interface GeneratedFrame {
  index: number;
  imageUrl: string;
  width: number;
  height: number;
  angle: string;
  zoom: string;
  mood: string;
}

export interface FrameManifest {
  frames: FrameEntry[];
  totalFrames: number;
  aspectRatio: string;
}

export interface FrameEntry {
  index: number;
  imageUrl: string;
  scrollStart: number; // 0-1
  scrollEnd: number; // 0-1
  transition: "crossfade" | "slide" | "zoom" | "none";
}

// Page generation types

export type SectionType =
  | "header"
  | "hero"
  | "features"
  | "showcase"
  | "stats"
  | "testimonial"
  | "cta"
  | "footer";

export interface FeatureItem {
  title: string;
  description: string;
  icon?: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
}

export interface SectionPlan {
  type: SectionType;
  frameIndex: number;
  headline: string;
  subheadline?: string;
  body: string;
  ctaText?: string;
  ctaLink?: string;
  features?: FeatureItem[];
  stats?: StatItem[];
  testimonials?: TestimonialItem[];
  navLinks?: string[];
  brandName?: string;
  copyrightText?: string;
  socialLinks?: string[];
}

export interface PagePlan {
  title: string;
  description: string;
  sections: SectionPlan[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fontFamily: string;
}

// Pipeline state

export type PipelineStatus =
  | "idle"
  | "generating-prompts"
  | "waiting-approval"
  | "generating-frames"
  | "processing-frames"
  | "planning-page"
  | "assembling"
  | "complete"
  | "error";

export type ApprovalStage = "prompts" | "frames" | "page-plan";

export interface PipelineState {
  status: PipelineStatus;
  progress: number; // 0-100
  message: string;
  framePrompts?: FramePrompt[];
  generatedFrames?: GeneratedFrame[];
  frameManifest?: FrameManifest;
  pagePlan?: PagePlan;
  error?: string;
  /** Set when status is "waiting-approval" */
  approvalStage?: ApprovalStage;
}

// Extracted site data

export interface ExtractedSite {
  title: string;
  description: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: string[];
  sections: string[];
  contentSnippets: string[];
  imageUrls: string[];
}

// User input

export interface UserInput {
  prompt: string;
  image?: File;
  imageBase64?: string;
  referenceUrl?: string;
  extractedSite?: ExtractedSite;
  frameCount: number;
}

// ─── Saved Page (like everforge v2 page model) ─────────────────

export type PageStatus =
  | "draft"
  | "generating"
  | "wireframe-completed"
  | "complete"
  | "error";

export interface SavedPage {
  id: string;
  name: string;
  description: string;
  status: PageStatus;
  referenceUrl?: string;
  additionalContext?: string;
  frameCount: number;
  prompt: string;
  // Generated data
  frameManifest?: FrameManifest;
  pagePlan?: PagePlan;
  // Brand & theme (extracted from reference URL)
  brandAndTheme?: import("./brand").BrandAndTheme;
  // Thumbnail (first frame data URI)
  thumbnailUrl?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
}

export interface CreatePageFormData {
  pageName: string;
  goal: string;
  referenceUrl?: string;
  context?: string;
  frameCount: number;
}
