import type { SectionPlan, PagePlan } from "../../types";

interface ShowcaseSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

export function ShowcaseSection({ section, colors, font }: ShowcaseSectionProps) {
  return (
    <section
      className="py-24 md:py-32"
      style={{ fontFamily: font, backgroundColor: colors.background }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Text Content */}
          <div className="space-y-6">
            <div
              className="w-12 h-1 rounded-full"
              style={{ backgroundColor: colors.accent }}
            />
            <h2
              className="text-3xl md:text-5xl font-bold leading-tight"
              style={{ color: colors.text }}
            >
              {section.headline}
            </h2>
            <p
              className="text-lg leading-relaxed"
              style={{ color: `${colors.text}77` }}
            >
              {section.body}
            </p>
            {section.ctaText && (
              <a
                href={section.ctaLink || "#"}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                style={{ backgroundColor: colors.accent, color: colors.background }}
              >
                {section.ctaText}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            )}
          </div>

          {/* Visual Placeholder */}
          <div
            className="aspect-square rounded-3xl border-2 border-dashed flex items-center justify-center"
            style={{
              borderColor: `${colors.text}15`,
              background: `linear-gradient(135deg, ${colors.primary}10, ${colors.accent}10)`,
            }}
          >
            <div
              className="w-24 h-24 rounded-2xl"
              style={{ backgroundColor: `${colors.accent}20` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
