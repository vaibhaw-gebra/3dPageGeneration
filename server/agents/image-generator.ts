import {
  VertexAI,
  type GenerateContentResult,
} from "@google-cloud/vertexai";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// ─── Types ──────────────────────────────────────────────────────

export type ImageProvider = "vertex-nano-banana" | "bedrock";

export interface ImageGenerationResult {
  imageUrl: string; // data:image/png;base64,...
  width: number;
  height: number;
}

// ─── Config ─────────────────────────────────────────────────────

const IMAGE_PROVIDER = (process.env.VITE_IMAGE_PROVIDER || "bedrock") as ImageProvider;
const GCP_PROJECT = process.env.VITE_GCP_PROJECT || "";
const GCP_LOCATION = process.env.VITE_GCP_LOCATION || "us-central1";
const NANO_BANANA_MODEL = process.env.VITE_NANO_BANANA_MODEL || "gemini-2.0-flash-exp";
const BEDROCK_IMAGE_MODEL = process.env.VITE_BEDROCK_IMAGE_MODEL_ID || "stability.sd3-5-large-v1:0";

// ─── Vertex AI (Nano Banana Pro) ────────────────────────────────

let vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    if (!GCP_PROJECT) {
      throw new Error("VITE_GCP_PROJECT is required for Vertex AI image generation");
    }
    vertexAI = new VertexAI({
      project: GCP_PROJECT,
      location: GCP_LOCATION,
    });
  }
  return vertexAI;
}

async function generateWithVertex(
  prompt: string,
  _seed: number
): Promise<ImageGenerationResult> {
  const ai = getVertexAI();
  const model = ai.getGenerativeModel({
    model: NANO_BANANA_MODEL,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 8192,
      // @ts-expect-error — responseModalities is supported but not in types yet
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const result: GenerateContentResult = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Generate a high-quality, cinematic image based on this description. Output ONLY the image, no text.\n\n${prompt}`,
          },
        ],
      },
    ],
  });

  const response = result.response;
  const candidates = response?.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("No response from Vertex AI");
  }

  // Find the image part in the response
  for (const part of candidates[0].content?.parts || []) {
    if (part.inlineData?.mimeType?.startsWith("image/")) {
      const base64 = part.inlineData.data;
      if (!base64) throw new Error("Empty image data from Vertex AI");
      const mime = part.inlineData.mimeType;
      return {
        imageUrl: `data:${mime};base64,${base64}`,
        width: 1024,
        height: 1024,
      };
    }
  }

  throw new Error("No image found in Vertex AI response");
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
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: prompt },
      imageGenerationConfig: { numberOfImages: 1, width: 1280, height: 720, seed: seed % 858993459, quality: "standard" },
    });
  }
  if (BEDROCK_IMAGE_MODEL.startsWith("amazon.titan-image")) {
    return JSON.stringify({
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: prompt },
      imageGenerationConfig: { numberOfImages: 1, width: 1280, height: 720, seed, quality: "standard" },
    });
  }
  if (BEDROCK_IMAGE_MODEL.includes("sd3")) {
    return JSON.stringify({
      prompt, seed: seed % 4294967295, mode: "text-to-image", output_format: "png", aspect_ratio: "16:9",
    });
  }
  if (BEDROCK_IMAGE_MODEL.startsWith("stability.")) {
    return JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, seed: seed % 4294967295, steps: 30, width: 1280, height: 720,
    });
  }
  throw new Error(`Unsupported image model: ${BEDROCK_IMAGE_MODEL}`);
}

function parseBedrockResponse(body: Uint8Array): string {
  const parsed = JSON.parse(new TextDecoder().decode(body));
  if (BEDROCK_IMAGE_MODEL.startsWith("amazon.nova-canvas") || BEDROCK_IMAGE_MODEL.startsWith("amazon.titan-image")) {
    const b64 = parsed.images?.[0];
    if (!b64) throw new Error("No image in response");
    return `data:image/png;base64,${b64}`;
  }
  if (BEDROCK_IMAGE_MODEL.includes("sd3")) {
    const b64 = parsed.images?.[0];
    if (!b64) throw new Error("No image in response");
    return `data:image/png;base64,${b64}`;
  }
  if (BEDROCK_IMAGE_MODEL.startsWith("stability.")) {
    const b64 = parsed.artifacts?.[0]?.base64;
    if (!b64) throw new Error("No image in response");
    return `data:image/png;base64,${b64}`;
  }
  throw new Error(`Unknown model: ${BEDROCK_IMAGE_MODEL}`);
}

// ─── Unified Interface ──────────────────────────────────────────

export async function generateImage(
  prompt: string,
  seed: number,
  bedrockCredentials?: any,
  bedrockRegion?: string
): Promise<ImageGenerationResult> {
  if (IMAGE_PROVIDER === "vertex-nano-banana") {
    return generateWithVertex(prompt, seed);
  }
  return generateWithBedrock(
    prompt,
    seed,
    bedrockCredentials,
    bedrockRegion || process.env.VITE_BEDROCK_IMAGE_REGION || process.env.VITE_AWS_REGION || "us-west-2"
  );
}

export function getImageProviderName(): string {
  if (IMAGE_PROVIDER === "vertex-nano-banana") {
    return `Nano Banana Pro (${NANO_BANANA_MODEL}) via Vertex AI [${GCP_PROJECT}/${GCP_LOCATION}]`;
  }
  return `${BEDROCK_IMAGE_MODEL} via Bedrock`;
}

export { IMAGE_PROVIDER };
