import type { FrameManifest, PagePlan } from "../types";

/**
 * Generates a standalone HTML file with embedded 3D scroll animation.
 * Uses vanilla Three.js + CSS scroll-driven animations (no React dependency in output).
 */
export function generateStandaloneHTML(
  frameManifest: FrameManifest,
  pagePlan: PagePlan
): string {
  const { sections, colorPalette: c, fontFamily } = pagePlan;

  const frameUrls = frameManifest.frames.map((f) => f.imageUrl);

  const sectionsHTML = sections
    .map((section, i) => {
      switch (section.type) {
        case "hero":
          return `
    <section class="section hero-section">
      <div class="overlay"></div>
      <div class="content">
        <h1>${section.headline}</h1>
        <p>${section.body}</p>
        ${section.ctaText ? `<a href="${section.ctaLink || "#"}" class="btn">${section.ctaText}</a>` : ""}
      </div>
    </section>`;
        case "cta":
          return `
    <section class="section cta-section">
      <div class="content">
        <h2>${section.headline}</h2>
        <p>${section.body}</p>
        ${section.ctaText ? `<a href="${section.ctaLink || "#"}" class="btn btn-lg">${section.ctaText}</a>` : ""}
      </div>
    </section>`;
        case "footer":
          return `
    <footer class="section footer-section">
      <div class="content">
        <h3>${section.headline}</h3>
        <p class="muted">${section.body}</p>
        <p class="credit">Built with 3D Website Generator</p>
      </div>
    </footer>`;
        default:
          return `
    <section class="section feature-section ${i % 2 ? "reversed" : ""}">
      <div class="content">
        <div class="accent-bar"></div>
        <h2>${section.headline}</h2>
        <p>${section.body}</p>
        ${section.ctaText ? `<a href="${section.ctaLink || "#"}" class="btn btn-outline">${section.ctaText}</a>` : ""}
      </div>
      <div class="visual-spacer"></div>
    </section>`;
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pagePlan.title}</title>
  <meta name="description" content="${pagePlan.description}">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: '${fontFamily}', system-ui, sans-serif; background: ${c.background}; color: ${c.text}; overflow-x: hidden; }

    /* 3D Canvas Background */
    #canvas-container { position: fixed; inset: 0; z-index: 0; }
    canvas { width: 100%; height: 100%; display: block; }

    /* Content Overlay */
    .content-wrapper { position: relative; z-index: 1; }
    .section { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 6rem 1.5rem; position: relative; }

    /* Hero */
    .hero-section { min-height: 100vh; }
    .hero-section .overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent, rgba(0,0,0,0.6)); }
    .hero-section .content { position: relative; z-index: 1; text-align: center; max-width: 56rem; }
    .hero-section h1 { font-size: clamp(3rem, 8vw, 6rem); font-weight: 700; line-height: 1.1; margin-bottom: 1.5rem; }
    .hero-section p { font-size: 1.25rem; opacity: 0.8; max-width: 40rem; margin: 0 auto 2rem; line-height: 1.6; }

    /* Feature */
    .feature-section { flex-direction: row; gap: 3rem; max-width: 72rem; margin: 0 auto; }
    .feature-section.reversed { flex-direction: row-reverse; }
    .feature-section .content { flex: 1; }
    .feature-section h2 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; margin-bottom: 1rem; }
    .feature-section p { font-size: 1.125rem; opacity: 0.7; line-height: 1.6; }
    .accent-bar { width: 3rem; height: 4px; background: ${c.accent}; border-radius: 2px; margin-bottom: 1.5rem; }
    .visual-spacer { flex: 1; aspect-ratio: 16/9; border-radius: 1rem; background: rgba(255,255,255,0.05); backdrop-filter: blur(2px); border: 1px solid rgba(255,255,255,0.1); }

    /* CTA */
    .cta-section .content { text-align: center; max-width: 48rem; }
    .cta-section h2 { font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 700; margin-bottom: 1.5rem; }
    .cta-section p { font-size: 1.25rem; opacity: 0.7; margin-bottom: 2rem; }

    /* Footer */
    .footer-section { min-height: 50vh; align-items: flex-end; padding-bottom: 4rem; }
    .footer-section .content { text-align: center; }
    .footer-section h3 { font-size: 1.5rem; opacity: 0.8; margin-bottom: 0.5rem; }
    .footer-section .muted { opacity: 0.4; font-size: 0.875rem; }
    .footer-section .credit { opacity: 0.25; font-size: 0.75rem; margin-top: 1rem; }

    /* Buttons */
    .btn { display: inline-block; padding: 1rem 2rem; border-radius: 9999px; font-weight: 600; text-decoration: none; transition: transform 0.2s; background: ${c.accent}; color: ${c.background}; }
    .btn:hover { transform: scale(1.05); }
    .btn-lg { padding: 1.25rem 2.5rem; font-size: 1.25rem; box-shadow: 0 0 40px ${c.accent}40; }
    .btn-outline { background: transparent; border: 2px solid ${c.accent}; color: ${c.accent}; padding: 0.75rem 1.5rem; font-size: 0.875rem; }

    @media (max-width: 768px) {
      .feature-section, .feature-section.reversed { flex-direction: column; }
      .section { padding: 4rem 1rem; }
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="content-wrapper">
${sectionsHTML}
  </div>

  <script type="importmap">
  { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js" } }
  </script>
  <script type="module">
    import * as THREE from 'three';

    const frameUrls = ${JSON.stringify(frameUrls)};
    const container = document.getElementById('canvas-container');

    // Setup Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${c.background}');
    const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Load textures
    const loader = new THREE.TextureLoader();
    const textures = await Promise.all(frameUrls.map(url =>
      new Promise(resolve => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); },
        undefined, () => resolve(null)))
    ));
    const validTextures = textures.filter(Boolean);

    // Crossfade shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        textureA: { value: validTextures[0] || null },
        textureB: { value: validTextures[1] || validTextures[0] || null },
        mixFactor: { value: 0 },
      },
      vertexShader: \`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }\`,
      fragmentShader: \`
        uniform sampler2D textureA; uniform sampler2D textureB; uniform float mixFactor; varying vec2 vUv;
        void main() { gl_FragColor = mix(texture2D(textureA, vUv), texture2D(textureB, vUv), smoothstep(0.0, 1.0, mixFactor)); }
      \`,
    });

    const aspect = 16 / 9, h = 6;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), material);
    scene.add(plane);

    // Animate on scroll
    function animate() {
      requestAnimationFrame(animate);
      const scrollY = window.scrollY;
      const maxScroll = document.body.scrollHeight - innerHeight;
      const t = maxScroll > 0 ? scrollY / maxScroll : 0;
      const n = validTextures.length;
      if (n > 0) {
        const f = t * (n - 1);
        const a = Math.floor(f), b = Math.min(a + 1, n - 1);
        material.uniforms.textureA.value = validTextures[a];
        material.uniforms.textureB.value = validTextures[b];
        material.uniforms.mixFactor.value = f - a;
      }
      plane.rotation.y = Math.sin(t * Math.PI) * 0.05;
      plane.rotation.x = Math.cos(t * Math.PI * 0.5) * 0.03;
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`;
}
