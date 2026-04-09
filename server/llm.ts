import { fromSSO } from "@aws-sdk/credential-providers";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.VITE_AWS_REGION || "us-west-2";
const PROFILE = process.env.VITE_AWS_PROFILE || "PowerUserAccess-361769573044";
const CLAUDE_MODEL_ID =
  process.env.VITE_BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-v1-0";

const ssoCredentials = fromSSO({ profile: PROFILE });

const claudeClient = new BedrockRuntimeClient({
  region: REGION,
  credentials: ssoCredentials,
});

/**
 * Invoke Claude via Bedrock Messages API. Returns raw text response.
 */
export async function invokeClaudeRaw(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192
): Promise<string> {
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const response = await claudeClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

export { claudeClient, ssoCredentials, REGION, PROFILE, CLAUDE_MODEL_ID };
