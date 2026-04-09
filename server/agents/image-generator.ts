import { GoogleGenAI } from "@google/genai";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// ─── Types ──────────────────────────────────────────────────────

export type ImageProvider = "gemini" | "bedrock";

export interface ImageGenerationResult {
  imageUrl: string;
  width: number;
  height: number;
}

// ─── Config ─────────────────────────────────────────────────────

// Support old "vertex-nano-banana" value as alias for "gemini"
const RAW_PROVIDER = process.env.VITE_IMAGE_PROVIDER || "gemini";
const IMAGE_PROVIDER: ImageProvider = RAW_PROVIDER === "vertex-nano-banana" ? "gemini" : RAW_PROVIDER as ImageProvider;

const GCP_PROJECT = process.env.VITE_GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
const GCP_LOCATION = process.env.VITE_GCP_LOCATION || "global";
const GEMINI_IMAGE_MODEL = process.env.VITE_GEMINI_IMAGE_MODEL || process.env.VITE_NANO_BANANA_MODEL || "gemini-3.1-flash-image-preview";
const BEDROCK_IMAGE_MODEL = process.env.VITE_BEDROCK_IMAGE_MODEL_ID || "stability.sd3-5-large-v1:0";

// ─── Gemini Native Image Generation via @google/genai ───────────

const genAI = new GoogleGenAI({
  vertexai: true,
  project: GCP_PROJECT,
  location: GCP_LOCATION,
});

async function generateWithGemini(
  prompt: string,
  _seed: number
): Promise<ImageGenerationResult> {
  const response = await genAI.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: `Photorealistic, ultra high quality, cinematic composition, 16:9 aspect ratio. ${prompt}`,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    throw new Error("Gemini returned no content parts");
  }

  // Find the image part
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return {
        imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
        width: 1280,
        height: 720,
      };
    }
  }

  // Check for finish reason errors
  const finishReason = candidates[0].finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new Error(`Gemini image generation failed: ${finishReason}`);
  }

  throw new Error("Gemini returned no image data in response");
}

// ─── Bedrock (SD 3.5 / Titan / Nova) ───────────────────────────

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(credentials: any, region: string): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({ region, credentials });
  }
  return bedrockClient;
}

async function generateWithBedrock(
  prompt: string,
  seed: number,
  credentials: any,
  region: string
): Promise<ImageGenerationResult> {
  const client = getBedrockClient(credentials, region);
  const body = buildBedrockBody(prompt, seed);

  const command = new InvokeModelCommand({
    modelId: BEDROCK_IMAGE_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await client.send(command);
  const imageUrl = parseBedrockResponse(response.body);
  return { imageUrl, width: 1280, height: 720 };
}

function buildBedrockBody(prompt: string, seed: number): string {
  if (BEDROCK_IMAGE_MODEL.startsWith("amazon.nova-canvas")) {
    return JSON.stringify({
      taskType: "TEXT_IMAGE", textToImageParams: { text: prompt },
      imageGenerationConfig: { numberOfImages: 1, width: 1280, height: 720, seed: seed % 858993459, quality: "standard" },
    });
  }
  if (BEDROCK_IMAGE_MODEL.startsWith("amazon.titan-image")) {
    return JSON.stringify({
      taskType: "TEXT_IMAGE", textToImageParams: { text: prompt },
      imageGenerationConfig: { numberOfImages: 1, width: 1280, height: 720, seed, quality: "standard" },
    });
  }
  if (BEDROCK_IMAGE_MODEL.includes("sd3")) {
    return JSON.stringify({ prompt, seed: seed % 4294967295, mode: "text-to-image", output_format: "png", aspect_ratio: "16:9" });
  }
  if (BEDROCK_IMAGE_MODEL.startsWith("stability.")) {
    return JSON.stringify({ text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, seed: seed % 4294967295, steps: 30, width: 1280, height: 720 });
  }
  throw new Error(`Unsupported image model: ${BEDROCK_IMAGE_MODEL}`);
}

function parseBedrockResponse(body: Uint8Array): string {
  const parsed = JSON.parse(new TextDecoder().decode(body));
  if (BEDROCK_IMAGE_MODEL.startsWith("amazon.nova-canvas") || BEDROCK_IMAGE_MODEL.startsWith("amazon.titan-image")) {
    return `data:image/png;base64,${parsed.images?.[0] || ""}`;
  }
  if (BEDROCK_IMAGE_MODEL.includes("sd3")) {
    return `data:image/png;base64,${parsed.images?.[0] || ""}`;
  }
  if (BEDROCK_IMAGE_MODEL.startsWith("stability.")) {
    return `data:image/png;base64,${parsed.artifacts?.[0]?.base64 || ""}`;
  }
  throw new Error(`Unknown model: ${BEDROCK_IMAGE_MODEL}`);
}

// ─── Unified Interface ──────────────────────────────────────────

export async function generateImageFromPrompt(
  prompt: string,
  seed: number,
  bedrockCredentials?: any,
  bedrockRegion?: string
): Promise<ImageGenerationResult> {
  if (IMAGE_PROVIDER === "gemini") {
    return generateWithGemini(prompt, seed);
  }
  return generateWithBedrock(prompt, seed, bedrockCredentials,
    bedrockRegion || process.env.VITE_BEDROCK_IMAGE_REGION || process.env.VITE_AWS_REGION || "us-west-2");
}

export function getImageProviderName(): string {
  if (IMAGE_PROVIDER === "gemini") {
    return `${GEMINI_IMAGE_MODEL} via Gemini/Vertex AI [${GCP_PROJECT}/${GCP_LOCATION}]`;
  }
  return `${BEDROCK_IMAGE_MODEL} via Bedrock`;
}

export { IMAGE_PROVIDER };
