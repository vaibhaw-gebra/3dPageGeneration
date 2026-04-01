import type { SectionPlan, PagePlan } from "../../types";

interface StatsSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

export function StatsSection({ section, colors, font }: StatsSectionProps) {
  const stats = section.stats || [];

  return (
    <section
      className="py-20 md:py-24"
      style={{
        fontFamily: font,
        backgroundColor: `${colors.primary}10`,
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {section.headline && (
          <h2
            className="text-2xl md:text-3xl font-bold text-center mb-12"
            style={{ color: colors.text }}
          >
            {section.headline}
          </h2>
        )}
        <div className={`grid gap-8 ${stats.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
          {stats.map((stat, i) => (
            <div key={i} className="text-center space-y-2">
              <p
                className="text-4xl md:text-5xl font-bold tracking-tight"
                style={{ color: colors.accent }}
              >
                {stat.value}
              </p>
              <p
                className="text-sm font-medium uppercase tracking-wider"
                style={{ color: `${colors.text}66` }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
