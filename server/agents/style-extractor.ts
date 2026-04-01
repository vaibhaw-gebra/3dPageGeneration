import { chromium, type Browser } from "playwright-core";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export interface ExtractedStyles {
  screenshot: string;
  colors: {
    backgrounds: string[];
    texts: string[];
    accents: string[];
    borders: string[];
  };
  fonts: string[];
  sections: string[];
  spacing: { headerHeight: number; sectionPadding: number };
  meta: { title: string; description: string; favicon: string };
  images: string[];
}

// This script runs inside the browser via page.evaluate.
// It MUST be a plain string to avoid tsx/esbuild transforms injecting __name.
const EXTRACTION_SCRIPT = `
(() => {
  const allElements = document.querySelectorAll("*");
  const bgColors = new Set();
  const textColors = new Set();
  const borderColors = new Set();
  const fontFamilies = new Set();
  const sectionTypes = [];
  const imageUrls = [];

  function rgbToHex(rgb) {
    const match = rgb.match(/\\d+/g);
    if (!match || match.length < 3) return rgb;
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
  }

  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();

    const bg = style.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
      bgColors.add(bg);
    }
    const color = style.color;
    if (color) textColors.add(color);
    const border = style.borderColor;
    if (border && border !== "rgb(0, 0, 0)") borderColors.add(border);

    const font = style.fontFamily.split(",")[0].trim().replace(/['"]/g, "");
    if (font) fontFamilies.add(font);

    if (
      tag === "section" || tag === "header" || tag === "footer" ||
      tag === "nav" || tag === "main" ||
      (tag === "div" && el.className && /hero|feature|testimonial|cta|pricing|about|contact|faq/i.test(el.className))
    ) {
      const cls = (el.className || "").toString();
      const id = el.id || "";
      const hint = cls + " " + id;
      if (/hero/i.test(hint)) sectionTypes.push("hero");
      else if (/feature/i.test(hint)) sectionTypes.push("features");
      else if (/testimonial|review/i.test(hint)) sectionTypes.push("testimonials");
      else if (/pricing/i.test(hint)) sectionTypes.push("pricing");
      else if (/cta|call.?to.?action/i.test(hint)) sectionTypes.push("cta");
      else if (/footer/i.test(hint) || tag === "footer") sectionTypes.push("footer");
      else if (/header|nav/i.test(hint) || tag === "header" || tag === "nav") sectionTypes.push("header");
      else if (/about/i.test(hint)) sectionTypes.push("about");
      else if (/contact/i.test(hint)) sectionTypes.push("contact");
      else if (/faq/i.test(hint)) sectionTypes.push("faq");
    }

    if (tag === "img") {
      const src = el.src;
      if (src && !src.startsWith("data:") && imageUrls.length < 8) {
        imageUrls.push(src);
      }
    }
  }

  const header = document.querySelector("header, nav, [class*=header], [class*=navbar]");
  const headerHeight = header ? header.offsetHeight : 64;

  const firstSection = document.querySelector("section");
  const sectionStyle = firstSection ? window.getComputedStyle(firstSection) : null;
  const sectionPadding = sectionStyle ? parseInt(sectionStyle.paddingTop) || 80 : 80;

  const title = document.title || "";
  const metaDesc = document.querySelector('meta[name="description"]');
  const description = metaDesc ? metaDesc.getAttribute("content") || "" : "";
  const faviconLink = document.querySelector('link[rel*="icon"]');
  const favicon = faviconLink ? faviconLink.getAttribute("href") || "" : "";

  const uniqueSections = [...new Set(sectionTypes)];

  return {
    backgrounds: [...bgColors].slice(0, 10).map(rgbToHex),
    texts: [...textColors].slice(0, 5).map(rgbToHex),
    borders: [...borderColors].slice(0, 5).map(rgbToHex),
    fonts: [...fontFamilies].slice(0, 5),
    sectionTypes: uniqueSections,
    headerHeight: headerHeight,
    sectionPadding: sectionPadding,
    title: title,
    description: description,
    favicon: favicon,
    imageUrls: imageUrls
  };
})()
`;

export async function extractStylesFromUrl(
  url: string
): Promise<ExtractedStyles> {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

    const screenshotBuffer = await page.screenshot({ type: "png", fullPage: false });
    const screenshot = screenshotBuffer.toString("base64");

    const extracted = await page.evaluate(EXTRACTION_SCRIPT) as {
      backgrounds: string[];
      texts: string[];
      borders: string[];
      fonts: string[];
      sectionTypes: string[];
      headerHeight: number;
      sectionPadding: number;
      title: string;
      description: string;
      favicon: string;
      imageUrls: string[];
    };

    return {
      screenshot,
      colors: {
        backgrounds: extracted.backgrounds,
        texts: extracted.texts,
        accents: extracted.backgrounds.slice(1, 4),
        borders: extracted.borders,
      },
      fonts: extracted.fonts,
      sections: extracted.sectionTypes,
      spacing: {
        headerHeight: extracted.headerHeight,
        sectionPadding: extracted.sectionPadding,
      },
      meta: {
        title: extracted.title,
        description: extracted.description,
        favicon: extracted.favicon,
      },
      images: extracted.imageUrls,
    };
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
