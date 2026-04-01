import type { SectionPlan, PagePlan } from "../../types";

interface FooterSectionProps {
  section: SectionPlan;
  colors: PagePlan["colorPalette"];
  font: string;
}

export function FooterSection({ section, colors, font }: FooterSectionProps) {
  return (
    <footer
      className="py-12 border-t"
      style={{
        fontFamily: font,
        backgroundColor: colors.background,
        borderColor: `${colors.text}10`,
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.accent }}
            >
              <span className="text-sm font-bold" style={{ color: colors.background }}>
                {(section.brandName || "E").charAt(0)}
              </span>
            </div>
            <span className="font-semibold" style={{ color: colors.text }}>
              {section.brandName || "Brand"}
            </span>
          </div>

          {/* Social Links */}
          {section.socialLinks && section.socialLinks.length > 0 && (
            <div className="flex items-center gap-4">
              {section.socialLinks.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-sm transition-colors hover:opacity-80"
                  style={{ color: `${colors.text}66` }}
                >
                  {link}
                </a>
              ))}
            </div>
          )}

          {/* Copyright */}
          <p className="text-sm" style={{ color: `${colors.text}44` }}>
            {section.copyrightText || `© ${new Date().getFullYear()} All rights reserved.`}
          </p>
        </div>
      </div>
    </footer>
  );
}
