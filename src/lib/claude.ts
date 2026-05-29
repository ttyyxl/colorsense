import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SYSTEM_PROMPT } from "@/prompts/system";
import { FALLBACK_ADVICE } from "@/prompts/fallback";

// 定义输出 Schema 校验
export const AiAdviceSchema = z.object({
  summary: z.string(),
  clothing: z.object({
    colors: z.array(z.string()),
    advice: z.string(),
  }),
  makeup: z.object({
    advice: z.string(),
  }),
  avoid: z.string(),
});

export type AiAdvice = z.infer<typeof AiAdviceSchema>;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function generateAiAdvice(userPrompt: string): Promise<AiAdvice> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[claude-service] ANTHROPIC_API_KEY is missing, using fallback.");
    return FALLBACK_ADVICE;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // 提取并校验 JSON
    try {
      // 尝试清理可能存在的 Markdown 代码块
      const jsonStr = content.text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      return AiAdviceSchema.parse(parsed);
    } catch (parseError) {
      console.error("[claude-service] JSON parse or validation failed", parseError);
      return FALLBACK_ADVICE;
    }
  } catch (error) {
    console.error("[claude-service] API call failed", error);
    return FALLBACK_ADVICE;
  }
}
