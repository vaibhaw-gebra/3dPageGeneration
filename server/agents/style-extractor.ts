import { chromium, type Browser } from "playwright-core";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export interface ExtractedLogo {
  src: string;
  alt: string;
  type: "img" | "svg" | "text";
  score?: number;
}

export interface ExtractedSection {
  type: string;
  tag: string;
  headings: string[];
  text: string;
  ctaButtons: string[];
  imageCount: number;
}

export interface ExtractedStyles {
  screenshot: string;
  colors: {
    backgrounds: string[];
    texts: string[];
    accents: string[];
    borders: string[];
    gradients: string[];
  };
  fonts: string[];
  sections: ExtractedSection[];
  sectionTypes: string[];
  spacing: { headerHeight: number; sectionPadding: number; borderRadius: string };
  meta: {
    title: string;
    description: string;
    favicon: string;
    ogImage: string;
    themeColor: string;
  };
  logos: ExtractedLogo[];
  navLinks: string[];
  socialLinks: string[];
  images: { src: string; alt: string; role: string }[];
  headings: { level: number; text: string }[];
  ctaTexts: string[];
  stats: string[];
  testimonials: { quote: string; author: string }[];
}

const EXTRACTION_SCRIPT = `
(() => {
  const result = {
    backgrounds: [],
    texts: [],
    borders: [],
    gradients: [],
    fonts: [],
    sections: [],
    sectionTypes: [],
    headerHeight: 64,
    sectionPadding: 80,
    borderRadius: "8px",
    title: document.title || "",
    description: "",
    favicon: "",
    ogImage: "",
    themeColor: "",
    logos: [],
    navLinks: [],
    socialLinks: [],
    images: [],
    headings: [],
    ctaTexts: [],
    stats: [],
    testimonials: []
  };

  function rgbToHex(rgb) {
    const m = rgb.match(/\\d+/g);
    if (!m || m.length < 3) return rgb;
    return "#" + [m[0], m[1], m[2]].map(c => parseInt(c).toString(16).padStart(2, "0")).join("");
  }

  function getVisibleText(el, maxLen) {
    const t = (el.innerText || "").trim();
    return t.length > maxLen ? t.slice(0, maxLen) + "..." : t;
  }

  // ── Meta tags ──
  const desc = document.querySelector('meta[name="description"]');
  result.description = desc ? desc.getAttribute("content") || "" : "";
  const fav = document.querySelector('link[rel*="icon"]');
  result.favicon = fav ? fav.getAttribute("href") || "" : "";
  const og = document.querySelector('meta[property="og:image"]');
  result.ogImage = og ? og.getAttribute("content") || "" : "";
  const theme = document.querySelector('meta[name="theme-color"]');
  result.themeColor = theme ? theme.getAttribute("content") || "" : "";

  // ── Logos (scored multi-strategy extraction) ──
  // Strategy: score every candidate img/svg in the page, pick top 3
  const logoCandidates = [];

  // Zone detection helper
  function getZone(el) {
    let cur = el;
    for (let i = 0; i < 8 && cur; i++) {
      const tag = (cur.tagName || "").toLowerCase();
      const cls = ((cur.className || "") + "").toLowerCase();
      const id = (cur.id || "").toLowerCase();
      const role = (cur.getAttribute && cur.getAttribute("role") || "").toLowerCase();
      const hint = tag + " " + cls + " " + id + " " + role;
      if (/header|navbar|topbar|site-header|masthead|nav-bar/i.test(hint) || tag === "header" || tag === "nav" || role === "banner") return "header";
      if (/footer|site-footer|bottom-bar/i.test(hint) || tag === "footer" || role === "contentinfo") return "footer";
      if (/article|story|post|blog|news|ticker|breaking|feed|card-grid|customer|testimonial|partner|showcase|case-study/i.test(hint)) return "content";
      cur = cur.parentElement;
    }
    return "unknown";
  }

  // Score a logo candidate
  function scoreLogo(el, type) {
    let score = 0;
    const rect = el.getBoundingClientRect();
    const cls = ((el.className || "") + "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const alt = (el.alt || el.getAttribute("aria-label") || "").toLowerCase();
    const hint = cls + " " + id + " " + alt;
    const zone = getZone(el);

    // Zone scoring (most important)
    if (zone === "header") score += 100;
    else if (zone === "footer") score += 10;
    else if (zone === "content") score -= 80;
    else score += 5;

    // Position scoring — top of page strongly preferred
    if (rect.top < 80) score += 40;
    else if (rect.top < 150) score += 25;
    else if (rect.top < 300) score += 10;
    else score -= 10;

    // Attribute keyword scoring
    if (/logo/i.test(hint)) score += 60;
    if (/brand|site-mark|wordmark|logotype/i.test(hint)) score += 40;
    if (/icon-only|site-icon|home-logo/i.test(hint)) score += 30;

    // Parent scan (5 levels) for logo context
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const pH = ((parent.className || "") + " " + (parent.id || "")).toLowerCase();
      if (/logo|brand|site-mark/i.test(pH)) score += 30;
      if (/sponsor|partner|customer|testimonial|featured|trusted|showcase|client/i.test(pH)) score -= 60;
      parent = parent.parentElement;
    }

    // Negative signals in element itself
    if (/sponsor|partner|customer|testimonial|featured|trusted|client|avatar|author|badge/i.test(hint)) score -= 70;

    // Homepage link detection (links to / or origin)
    const closestLink = el.closest("a");
    if (closestLink) {
      const href = closestLink.getAttribute("href") || "";
      if (href === "/" || href === window.location.origin || href === window.location.origin + "/") score += 40;
    }

    // Size scoring for images
    if (type === "img") {
      const w = el.naturalWidth || el.width || rect.width;
      const h = el.naturalHeight || el.height || rect.height;
      // Typical logo: 20-300px wide, 10-100px tall
      if (w >= 20 && w <= 300 && h >= 10 && h <= 100) score += 25;
      // Too large (probably hero or content image)
      if (w > 500 || h > 200) score -= 40;
      // Tiny (probably icon, not logo)
      if (w < 15 || h < 15) score -= 20;
    }

    // SVG with aria-label containing brand name
    if (type === "svg") {
      const label = el.getAttribute("aria-label") || "";
      if (/logo/i.test(label)) score += 50;
      // SVGs in header that are reasonably sized are likely logos
      if (zone === "header" && rect.width > 20 && rect.width < 300) score += 20;
    }

    return score;
  }

  // Scan ALL images on the page
  const allImgs = document.querySelectorAll("img");
  for (const img of allImgs) {
    const src = img.src || img.getAttribute("data-src") || "";
    if (!src || src.startsWith("data:image/gif") || src.includes("pixel") || src.includes("spacer")) continue;
    const s = scoreLogo(img, "img");
    if (s > -20) { // Only include reasonable candidates
      logoCandidates.push({ src, alt: img.alt || "", type: "img", score: s, el: img });
    }
  }

  // Scan ALL SVGs on the page
  const allSvgs = document.querySelectorAll("svg");
  for (const svg of allSvgs) {
    const rect = svg.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) continue; // skip tiny icons
    const s = scoreLogo(svg, "svg");
    if (s > 0) {
      // Resolve <use> references by inlining <symbol> content
      let svgStr = svg.outerHTML;
      const useEls = svg.querySelectorAll("use");
      for (const use of useEls) {
        const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
        if (href.startsWith("#")) {
          const sym = document.querySelector(href);
          if (sym) svgStr = svgStr.replace(use.outerHTML, sym.innerHTML);
        }
      }
      const label = svg.getAttribute("aria-label") || svg.closest("[aria-label]")?.getAttribute("aria-label") || "";
      logoCandidates.push({ src: svgStr.slice(0, 2000), alt: label || "svg-logo", type: "svg", score: s, el: svg });
    }
  }

  // Scan text-based logos (e.g., <span class="logo">BrandName</span>)
  const textLogoEls = document.querySelectorAll("[class*=logo], [class*=brand], [class*=wordmark], [class*=site-name]");
  for (const el of textLogoEls) {
    const text = (el.textContent || "").trim();
    if (!text || text.length > 40 || text.length < 1) continue;
    // Only if it doesn't contain img/svg children (those are already scanned)
    if (el.querySelector("img") || el.querySelector("svg")) continue;
    const s = scoreLogo(el, "text");
    if (s > 0) {
      logoCandidates.push({ src: "", alt: text, type: "text", score: s, el: el });
    }
  }

  // Sort by score descending, take top 3
  logoCandidates.sort((a, b) => b.score - a.score);
  for (const c of logoCandidates.slice(0, 3)) {
    result.logos.push({ src: c.src, alt: c.alt, type: c.type, score: c.score });
  }

  // ── Nav links (from header/nav) ──
  const headerEl = document.querySelector("header, nav, [class*=header], [class*=navbar], [class*=topbar]");
  if (headerEl) {
    result.headerHeight = headerEl.offsetHeight || 64;
    const navAnchors = headerEl.querySelectorAll("a");
    for (const a of navAnchors) {
      const text = (a.textContent || "").trim();
      if (text && text.length < 30 && !a.querySelector("img") && !a.querySelector("svg")) {
        result.navLinks.push(text);
      }
    }
  }

  // ── Colors — sample key elements, not all ──
  const colorSamples = document.querySelectorAll("body, header, footer, section, main, [class*=hero], [class*=cta], nav, h1, h2, h3, p, a, button");
  const bgSet = new Set();
  const textSet = new Set();
  const borderSet = new Set();
  const gradientSet = new Set();
  const radiusSet = new Set();

  for (const el of colorSamples) {
    const s = window.getComputedStyle(el);
    const bg = s.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") bgSet.add(bg);
    const c = s.color;
    if (c) textSet.add(c);
    const bc = s.borderColor;
    if (bc && bc !== "rgb(0, 0, 0)" && bc !== "rgba(0, 0, 0, 0)") borderSet.add(bc);
    const bgImg = s.backgroundImage;
    if (bgImg && bgImg.includes("gradient")) gradientSet.add(bgImg.slice(0, 200));
    const br = s.borderRadius;
    if (br && br !== "0px") radiusSet.add(br);
  }

  result.backgrounds = [...bgSet].slice(0, 12).map(rgbToHex);
  result.texts = [...textSet].slice(0, 8).map(rgbToHex);
  result.borders = [...borderSet].slice(0, 6).map(rgbToHex);
  result.gradients = [...gradientSet].slice(0, 4);
  result.borderRadius = [...radiusSet][0] || "8px";

  // ── Fonts — from body and headings ──
  const fontSet = new Set();
  for (const sel of ["body", "h1", "h2", "h3", "p", "button", "a"]) {
    const el = document.querySelector(sel);
    if (el) {
      const f = window.getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/['"]/g, "");
      if (f) fontSet.add(f);
    }
  }
  result.fonts = [...fontSet].slice(0, 5);

  // ── Headings ──
  for (const level of [1, 2, 3, 4]) {
    const hEls = document.querySelectorAll("h" + level);
    for (const h of hEls) {
      const t = (h.textContent || "").trim();
      if (t && t.length > 2 && t.length < 200) {
        result.headings.push({ level, text: t });
      }
    }
  }

  // ── Sections — deep analysis ──
  const sectionEls = document.querySelectorAll("section, [class*=section], header, footer, main > div, [role=main] > div");
  const sectionTypeSet = new Set();

  for (const sec of sectionEls) {
    const cls = (sec.className || "").toString().toLowerCase();
    const id = (sec.id || "").toLowerCase();
    const tag = sec.tagName.toLowerCase();
    const hint = cls + " " + id + " " + tag;

    let type = "content";
    if (/hero|banner|jumbotron|splash/i.test(hint)) type = "hero";
    else if (/feature|benefit|service|capability/i.test(hint)) type = "features";
    else if (/testimonial|review|quote|customer/i.test(hint)) type = "testimonials";
    else if (/pricing|plan|tier/i.test(hint)) type = "pricing";
    else if (/cta|call.?to.?action|get.?started|sign.?up/i.test(hint)) type = "cta";
    else if (/footer/i.test(hint) || tag === "footer") type = "footer";
    else if (/header|nav/i.test(hint) || tag === "header") type = "header";
    else if (/about|story|mission/i.test(hint)) type = "about";
    else if (/stat|number|metric|counter/i.test(hint)) type = "stats";
    else if (/faq|question|accordion/i.test(hint)) type = "faq";
    else if (/partner|client|logo|trusted/i.test(hint)) type = "logos";
    else if (/contact|form/i.test(hint)) type = "contact";
    else if (/gallery|showcase|portfolio/i.test(hint)) type = "showcase";

    sectionTypeSet.add(type);

    // Extract section details
    const secHeadings = [];
    for (const h of sec.querySelectorAll("h1, h2, h3, h4")) {
      const t = (h.textContent || "").trim();
      if (t && t.length < 150) secHeadings.push(t);
    }

    const ctaBtns = [];
    for (const btn of sec.querySelectorAll("a, button")) {
      const t = (btn.textContent || "").trim();
      const s = window.getComputedStyle(btn);
      if (t && t.length < 40 && (s.backgroundColor !== "rgba(0, 0, 0, 0)" || btn.tagName === "BUTTON" || btn.getAttribute("role") === "button")) {
        ctaBtns.push(t);
      }
    }

    result.sections.push({
      type,
      tag,
      headings: secHeadings.slice(0, 3),
      text: getVisibleText(sec, 300),
      ctaButtons: [...new Set(ctaBtns)].slice(0, 3),
      imageCount: sec.querySelectorAll("img").length
    });
  }

  result.sectionTypes = [...sectionTypeSet];

  // ── CTA Texts — all buttons and prominent links ──
  const ctaSet = new Set();
  for (const btn of document.querySelectorAll("button, a[class*=btn], a[class*=button], a[class*=cta], [role=button]")) {
    const t = (btn.textContent || "").trim();
    if (t && t.length > 1 && t.length < 40) ctaSet.add(t);
  }
  result.ctaTexts = [...ctaSet].slice(0, 10);

  // ── Images — categorized ──
  const imgEls = document.querySelectorAll("img");
  for (const img of imgEls) {
    if (result.images.length >= 15) break;
    const src = img.src || img.getAttribute("data-src") || "";
    if (!src || src.startsWith("data:")) continue;
    const alt = img.alt || "";
    const w = img.naturalWidth || img.width;
    const parent = img.closest("section, header, footer, [class*=hero], [class*=testimonial]");
    const parentHint = parent ? ((parent.className || "") + " " + (parent.id || "")).toLowerCase() : "";

    let role = "decorative";
    if (/logo/i.test(alt) || w < 200) role = "logo";
    else if (/hero|banner/i.test(parentHint) || (w > 600 && img.closest("[class*=hero], [class*=banner]"))) role = "hero";
    else if (/avatar|headshot|portrait|team/i.test(alt + " " + parentHint)) role = "avatar";
    else if (/product|feature|screenshot/i.test(alt + " " + parentHint)) role = "product";
    else if (w > 400) role = "feature";

    result.images.push({ src, alt, role });
  }

  // ── Stats — numbers with labels ──
  const statEls = document.querySelectorAll("[class*=stat] *, [class*=number] *, [class*=metric] *, [class*=counter] *");
  for (const el of statEls) {
    const t = (el.textContent || "").trim();
    if (/^[\\d,\\.]+[+%xXkKmM]*$/.test(t) || /^\\d/.test(t)) {
      result.stats.push(t);
    }
  }
  result.stats = [...new Set(result.stats)].slice(0, 8);

  // ── Testimonials ──
  const quoteEls = document.querySelectorAll("[class*=testimonial], [class*=review], [class*=quote], blockquote");
  for (const q of quoteEls) {
    const text = getVisibleText(q, 300);
    const authorEl = q.querySelector("[class*=author], [class*=name], cite, figcaption, strong");
    const author = authorEl ? (authorEl.textContent || "").trim() : "";
    if (text && text.length > 20) {
      result.testimonials.push({ quote: text, author });
    }
  }
  result.testimonials = result.testimonials.slice(0, 5);

  // ── Social Links ──
  const socialPatterns = /twitter|x\\.com|facebook|linkedin|instagram|youtube|github|tiktok|discord/i;
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (socialPatterns.test(href)) {
      const name = href.match(socialPatterns)?.[0] || "";
      result.socialLinks.push(name.charAt(0).toUpperCase() + name.slice(1).replace(".com", ""));
    }
  }
  result.socialLinks = [...new Set(result.socialLinks)].slice(0, 8);

  // ── Section padding from first content section ──
  const firstSec = document.querySelector("section");
  if (firstSec) {
    const sp = window.getComputedStyle(firstSec);
    result.sectionPadding = parseInt(sp.paddingTop) || 80;
  }

  return result;
})()
`;

export async function extractStylesFromUrl(
  url: string
): Promise<ExtractedStyles> {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    } catch (navError: any) {
      if (navError.message?.includes("ERR_NAME_NOT_RESOLVED")) {
        throw new Error(`Could not reach "${url}" — domain doesn't exist or DNS failed.`);
      }
      if (navError.message?.includes("ERR_CONNECTION_REFUSED")) {
        throw new Error(`Connection refused by "${url}" — server may be down.`);
      }
      // Timeout is ok — page might still have loaded partially
      if (!navError.message?.includes("Timeout")) throw navError;
    }

    // Scroll down to trigger lazy-loaded content
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)");
    await page.waitForTimeout(1000);
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(1000);
    await page.evaluate("window.scrollTo(0, 0)");
    await page.waitForTimeout(500);

    // Screenshot
    const screenshotBuffer = await page.screenshot({ type: "png", fullPage: false });
    const screenshot = screenshotBuffer.toString("base64");

    // Full-page screenshot for below-the-fold content
    let fullScreenshot = "";
    try {
      const fullBuf = await page.screenshot({ type: "png", fullPage: true, timeout: 10000 });
      fullScreenshot = fullBuf.toString("base64");
    } catch {
      // Full-page screenshot can fail on very tall pages — that's ok
    }

    // Run extraction script
    const raw = await page.evaluate(EXTRACTION_SCRIPT) as any;

    return {
      screenshot: fullScreenshot || screenshot,
      colors: {
        backgrounds: raw.backgrounds,
        texts: raw.texts,
        accents: raw.backgrounds.filter((c: string) => c !== raw.backgrounds[0]).slice(0, 4),
        borders: raw.borders,
        gradients: raw.gradients,
      },
      fonts: raw.fonts,
      sections: raw.sections,
      sectionTypes: raw.sectionTypes,
      spacing: {
        headerHeight: raw.headerHeight,
        sectionPadding: raw.sectionPadding,
        borderRadius: raw.borderRadius,
      },
      meta: {
        title: raw.title,
        description: raw.description,
        favicon: raw.favicon,
        ogImage: raw.ogImage,
        themeColor: raw.themeColor,
      },
      logos: raw.logos,
      navLinks: raw.navLinks,
      socialLinks: raw.socialLinks,
      images: raw.images,
      headings: raw.headings,
      ctaTexts: raw.ctaTexts,
      stats: raw.stats,
      testimonials: raw.testimonials,
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
