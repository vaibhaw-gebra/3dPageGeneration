import type { SectionPlan, PagePlan } from "../../types";

interface HeaderSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

export function HeaderSection({ section, colors, font }: HeaderSectionProps) {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{
        fontFamily: font,
        backgroundColor: `${colors.background}cc`,
        borderColor: `${colors.text}15`,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-lg font-bold" style={{ color: colors.text }}>
          {section.brandName || "Brand"}
        </span>
        <nav className="hidden md:flex items-center gap-8">
          {(section.navLinks || []).map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: `${colors.text}aa` }}
            >
              {link}
            </a>
          ))}
          <a
            href="#"
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: colors.accent, color: colors.background }}
          >
            Get Started
          </a>
        </nav>
      </div>
    </header>
  );
}
