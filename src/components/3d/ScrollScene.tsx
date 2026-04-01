import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FrameManifest } from "../../types";

/**
 * FrameRenderer — crossfades between frame textures based on a scroll progress value (0–1).
 * Does NOT use R3F ScrollControls — reads progress from a ref set by the parent.
 */
function FrameRenderer({
  frameManifest,
  progressRef,
}: {
  frameManifest: FrameManifest;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const { viewport } = useThree();

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const promises = frameManifest.frames.map(
      (frame) =>
        new Promise<THREE.Texture>((resolve) => {
          loader.load(
            frame.imageUrl,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.minFilter = THREE.LinearFilter;
              resolve(tex);
            },
            undefined,
            () => {
              const c = document.createElement("canvas");
              c.width = 1920;
              c.height = 1080;
              const ctx = c.getContext("2d")!;
              ctx.fillStyle = `hsl(${frame.index * 40}, 50%, 15%)`;
              ctx.fillRect(0, 0, 1920, 1080);
              const t = new THREE.CanvasTexture(c);
              t.colorSpace = THREE.SRGBColorSpace;
              resolve(t);
            }
          );
        })
    );
    Promise.all(promises).then(setTextures);
  }, [frameManifest]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          textureA: { value: null },
          textureB: { value: null },
          mixFactor: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D textureA;
          uniform sampler2D textureB;
          uniform float mixFactor;
          varying vec2 vUv;
          void main() {
            vec4 a = texture2D(textureA, vUv);
            vec4 b = texture2D(textureB, vUv);
            vec4 color = mix(a, b, smoothstep(0.0, 1.0, mixFactor));
            // Vignette
            vec2 uv = vUv * 2.0 - 1.0;
            float vig = 1.0 - dot(uv, uv) * 0.25;
            color.rgb *= vig;
            gl_FragColor = color;
          }
        `,
        transparent: true,
      }),
    []
  );

  useFrame(() => {
    if (textures.length === 0 || !meshRef.current) return;
    const t = Math.min(Math.max(progressRef.current, 0), 1);
    const n = textures.length;
    const f = t * (n - 1);
    const a = Math.floor(f);
    const b = Math.min(a + 1, n - 1);
    material.uniforms.textureA.value = textures[a];
    material.uniforms.textureB.value = textures[b];
    material.uniforms.mixFactor.value = f - a;

    // Subtle camera movement
    meshRef.current.rotation.y = Math.sin(t * Math.PI) * 0.03;
    meshRef.current.rotation.x = Math.cos(t * Math.PI * 0.5) * 0.02;
    meshRef.current.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.04);
  });

  // Size the plane to fill the viewport
  const aspect = 16 / 9;
  const planeHeight = viewport.height * 1.2;
  const planeWidth = Math.max(planeHeight * aspect, viewport.width * 1.2);

  return (
    <mesh ref={meshRef} material={material}>
      <planeGeometry args={[planeWidth, planeHeight]} />
    </mesh>
  );
}

interface ScrollSceneProps {
  frameManifest: FrameManifest;
}

/**
 * ScrollScene renders a Three.js canvas that crossfades frames based on
 * the native page scroll position of its container element.
 * It does NOT capture scroll — the page scrolls normally.
 */
export function ScrollScene({ frameManifest }: ScrollSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  const scrollParentRef = useRef<Element | Window | null>(null);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollParent = scrollParentRef.current;
    if (!scrollParent) return;

    // Get the scroll position of the parent container
    const parentScrollTop =
      scrollParent instanceof Window
        ? scrollParent.scrollY
        : (scrollParent as HTMLElement).scrollTop;

    // Get the hero container's offset within the scroll parent
    const heroTop = el.offsetTop;
    const heroHeight = el.offsetHeight;
    const viewportHeight =
      scrollParent instanceof Window
        ? window.innerHeight
        : (scrollParent as HTMLElement).clientHeight;

    // How far through the hero section the scroll has gone
    const scrolled = parentScrollTop - heroTop;
    const scrollableRange = heroHeight - viewportHeight;

    if (scrollableRange <= 0) {
      progressRef.current = 0;
      return;
    }

    progressRef.current = Math.min(Math.max(scrolled / scrollableRange, 0), 1);
  }, []);

  useEffect(() => {
    const scrollParent =
      containerRef.current?.closest("[data-preview-scroll]") || window;
    scrollParentRef.current = scrollParent;
    const target = scrollParent === window ? window : scrollParent;
    target.addEventListener("scroll", handleScroll as EventListener, {
      passive: true,
    });
    handleScroll();
    return () =>
      target.removeEventListener("scroll", handleScroll as EventListener);
  }, [handleScroll]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: "300vh" }}>
      {/* Sticky canvas that stays in view while we scroll through the hero */}
      <div className="sticky top-0 w-full h-screen">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <FrameRenderer frameManifest={frameManifest} progressRef={progressRef} />
        </Canvas>
      </div>
    </div>
  );
}
