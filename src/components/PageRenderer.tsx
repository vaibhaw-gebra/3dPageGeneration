import type { PagePlan, FrameManifest } from "../types";
import {
  HeaderSection,
  HeroSection,
  FeatureSection,
  StatsSection,
  ShowcaseSection,
  TestimonialSection,
  CTASection,
  FooterSection,
} from "./sections";

interface PageRendererProps {
  pagePlan: PagePlan;
  frameManifest: FrameManifest;
}

export function PageRenderer({ pagePlan, frameManifest }: PageRendererProps) {
  const { sections, colorPalette, fontFamily } = pagePlan;

  // Separate header and hero from content sections
  const headerSection = sections.find((s) => s.type === "header");
  const heroSection = sections.find((s) => s.type === "hero");
  const contentSections = sections.filter(
    (s) => s.type !== "header" && s.type !== "hero"
  );

  const sharedProps = { colors: colorPalette, font: fontFamily };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colorPalette.background, color: colorPalette.text }}
    >
      {/* Fixed Header */}
      {headerSection && <HeaderSection section={headerSection} {...sharedProps} />}

      {/* Hero with 3D scroll scene */}
      {heroSection && (
        <HeroSection
          section={heroSection}
          frameManifest={frameManifest}
          {...sharedProps}
        />
      )}

      {/* Content Sections — regular, non-3D */}
      {contentSections.map((section, i) => {
        const key = `${section.type}-${i}`;
        switch (section.type) {
          case "features":
            return <FeatureSection key={key} section={section} {...sharedProps} />;
          case "stats":
            return <StatsSection key={key} section={section} {...sharedProps} />;
          case "showcase":
            return <ShowcaseSection key={key} section={section} {...sharedProps} />;
          case "testimonial":
            return <TestimonialSection key={key} section={section} {...sharedProps} />;
          case "cta":
            return <CTASection key={key} section={section} {...sharedProps} />;
          case "footer":
            return <FooterSection key={key} section={section} {...sharedProps} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
