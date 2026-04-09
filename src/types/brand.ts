// ─── Brand & Theme types (ported from everforge v2) ─────────────

export interface BrandAssets {
  logo: {
    light?: string | null;
    dark?: string | null;
    alt?: string | null;
  };
  favicon: string;
  heroBackgroundImage?: string | null;
  socials?: {
    twitter?: string | null;
    linkedin?: string | null;
    github?: string | null;
    instagram?: string | null;
  };
}

export interface BrandVoice {
  persona?: string;
  tone?: string;
}

export interface ContentStyle {
  archetype?: "Expert" | "Friendly" | "Bold" | "Minimalist";
  sliders?: {
    casual?: number;
    technical?: number;
    enthusiastic?: number;
  };
}

export interface BrandStrategy {
  industry?: string;
  valueProposition?: string;
  pricingModel?: "free" | "enterprise" | "subscription";
  voice?: BrandVoice;
  style?: ContentStyle;
}

export interface ThemeTokens {
  // Brand colors
  "--color-primary": string;
  "--color-primary-fg": string;
  "--color-accent"?: string | null;
  "--color-accent-fg"?: string | null;
  // Surfaces
  "--bg-canvas": string;
  "--bg-surface": string;
  "--bg-subtle"?: string | null;
  // Text
  "--text-main": string;
  "--text-muted": string;
  // Typography
  "--font-heading": string;
  "--font-body": string;
  "--font-heading-weight": string;
  "--font-body-size": string;
  "--font-body-height": string;
  // Styling
  "--radius-btn": string;
  "--radius-card": string;
  "--shadow-card": string;
  "--border-subtle": string;
  "--border-width": string;
  // Motion
  "--transition-dur": string;
  "--hover-lift": string;
  // Inverse (dark mode)
  "--inverse-bg-canvas": string;
  "--inverse-bg-surface": string;
  "--inverse-text-main": string;
  "--inverse-text-muted": string;
  // Allow additional tokens
  [key: string]: string | null | undefined;
}

export interface ThemeConfig {
  tokens: ThemeTokens;
}

export interface BrandAndTheme {
  brandAssets?: BrandAssets;
  strategy?: BrandStrategy;
  themeConfig?: ThemeConfig;
}

export interface BrandExtractionResult {
  brandAndTheme: BrandAndTheme;
  extractionMetadata: {
    sourceUrl: string;
    extractedAt: string;
    screenshotBase64?: string;
    durationMs: number;
  };
}
