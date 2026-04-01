import type { SectionPlan, PagePlan } from "../../types";

interface TestimonialSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

export function TestimonialSection({ section, colors, font }: TestimonialSectionProps) {
  const testimonials = section.testimonials || [];

  return (
    <section
      className="py-24 md:py-32"
      style={{ fontFamily: font, backgroundColor: `${colors.text}05` }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <h2
          className="text-3xl md:text-4xl font-bold text-center mb-16"
          style={{ color: colors.text }}
        >
          {section.headline}
        </h2>

        <div className={`grid gap-8 ${testimonials.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2 max-w-4xl mx-auto"}`}>
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              className="p-8 rounded-2xl border"
              style={{
                backgroundColor: colors.background,
                borderColor: `${colors.text}10`,
              }}
            >
              {/* Quote mark */}
              <svg
                className="w-8 h-8 mb-4"
                style={{ color: `${colors.accent}40` }}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
              </svg>

              <p
                className="text-base leading-relaxed mb-6"
                style={{ color: `${colors.text}bb` }}
              >
                "{testimonial.quote}"
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: `${colors.accent}20`, color: colors.accent }}
                >
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: colors.text }}>
                    {testimonial.author}
                  </p>
                  <p className="text-xs" style={{ color: `${colors.text}66` }}>
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
