import type { SectionPlan, PagePlan } from "../../types";

interface FeatureSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

const ICON_MAP: Record<string, string> = {
  sparkles: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622A11.99 11.99 0 0018.402 6a11.959 11.959 0 00-6.402-2.286z",
  zap: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  globe: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582",
  rocket: "M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z",
};

function FeatureIcon({ icon, accentColor }: { icon?: string; accentColor: string }) {
  const path = ICON_MAP[icon || "sparkles"] || ICON_MAP.sparkles;
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
      style={{ backgroundColor: `${accentColor}15` }}
    >
      <svg className="w-6 h-6" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </div>
  );
}

export function FeatureSection({ section, colors, font }: FeatureSectionProps) {
  const features = section.features || [];

  return (
    <section
      id="features"
      className="py-24 md:py-32"
      style={{ fontFamily: font, backgroundColor: colors.background }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          {section.subheadline && (
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: colors.accent }}>
              {section.subheadline}
            </p>
          )}
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: colors.text }}>
            {section.headline}
          </h2>
          {section.body && (
            <p className="text-lg leading-relaxed" style={{ color: `${colors.text}77` }}>
              {section.body}
            </p>
          )}
        </div>

        {/* Feature Grid */}
        <div className={`grid gap-8 ${features.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border transition-all hover:-translate-y-1"
              style={{
                backgroundColor: `${colors.text}05`,
                borderColor: `${colors.text}10`,
              }}
            >
              <FeatureIcon icon={feature.icon} accentColor={colors.accent} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: `${colors.text}77` }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
