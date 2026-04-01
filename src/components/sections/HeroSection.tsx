import type { SectionPlan, PagePlan, FrameManifest } from "../../types";
import { ScrollScene } from "../3d/ScrollScene";

interface HeroSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
  frameManifest: FrameManifest;
}

export function HeroSection({ section, colors, font, frameManifest }: HeroSectionProps) {
  return (
    <div className="relative" style={{ fontFamily: font }}>
      {/* 3D Scene — scrolls through frames over 300vh, canvas is sticky */}
      <ScrollScene frameManifest={frameManifest} />

      {/* Hero text overlay — sticky on first screen, sits above the 3D canvas */}
      <div
        className="absolute top-0 left-0 right-0 h-screen flex items-center justify-center z-10 pointer-events-none"
      >
        {/* Gradient overlays for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${colors.background}99 0%, transparent 30%, transparent 60%, ${colors.background} 100%)`,
          }}
        />

        <div className="relative text-center max-w-4xl px-6 space-y-6 pointer-events-auto">
          {section.subheadline && (
            <p
              className="text-sm md:text-base font-medium uppercase tracking-widest"
              style={{ color: colors.accent }}
            >
              {section.subheadline}
            </p>
          )}
          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight"
            style={{ color: colors.text }}
          >
            {section.headline}
          </h1>
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: `${colors.text}99` }}
          >
            {section.body}
          </p>
          {section.ctaText && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <a
                href={section.ctaLink || "#"}
                className="px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 shadow-lg"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.background,
                  boxShadow: `0 8px 32px ${colors.accent}40`,
                }}
              >
                {section.ctaText}
              </a>
              <a
                href="#features"
                className="px-8 py-4 rounded-xl text-lg font-semibold border-2 transition-colors hover:opacity-80"
                style={{ borderColor: `${colors.text}30`, color: colors.text }}
              >
                Learn More
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
