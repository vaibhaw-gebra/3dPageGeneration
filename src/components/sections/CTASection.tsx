import type { SectionPlan, PagePlan } from "../../types";

interface CTASectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

export function CTASection({ section, colors, font }: CTASectionProps) {
  return (
    <section
      className="py-24 md:py-32"
      style={{ fontFamily: font, backgroundColor: colors.background }}
    >
      <div className="max-w-4xl mx-auto px-6">
        <div
          className="relative overflow-hidden rounded-3xl p-12 md:p-16 text-center"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-20"
            style={{ backgroundColor: colors.background }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-10"
            style={{ backgroundColor: colors.background }}
          />

          <div className="relative space-y-6">
            <h2
              className="text-3xl md:text-5xl font-bold"
              style={{ color: colors.background }}
            >
              {section.headline}
            </h2>
            <p
              className="text-lg max-w-xl mx-auto"
              style={{ color: `${colors.background}cc` }}
            >
              {section.body}
            </p>
            {section.ctaText && (
              <a
                href={section.ctaLink || "#"}
                className="inline-block px-10 py-4 rounded-xl text-lg font-bold transition-all hover:scale-105 shadow-xl"
                style={{
                  backgroundColor: colors.background,
                  color: colors.accent,
                }}
              >
                {section.ctaText}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
