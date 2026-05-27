import OpenAI from "openai";
import { DOUBAO_SYSTEM_PROMPT } from "@/prompts/doubaoSystem";
import { DOUBAO_FALLBACK_ADVICE } from "@/prompts/doubaoFallback";

const apiKey = process.env.ARK_API_KEY || "";
const baseURL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const model = process.env.ARK_MODEL || "doubao-seed-2-0-pro-260215";

export interface DoubaoStyleAdvice {
  title: string;
  summary: string;
  style_keywords: string[];
  fashion_recommendations: string[];
  makeup_recommendations: string[];
  hair_recommendations: string[];
  accessory_recommendations: string[];
  avoid_recommendations: string[];
}

export async function generateDoubaoStyleAdvice(userPrompt: string): Promise<DoubaoStyleAdvice> {
  if (!apiKey) {
    console.warn("[doubao-service] ARK_API_KEY is missing, using fallback.");
    return DOUBAO_FALLBACK_ADVICE;
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL,
    });
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: DOUBAO_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      // 豆包模型通常支持 json_object 模式，这里开启以增强稳定性
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from Doubao API");
    }

    try {
      // 清理可能存在的 Markdown 代码块
      const cleanJson = content.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanJson) as DoubaoStyleAdvice;
    } catch (parseError) {
      console.error("[doubao-service] JSON parse failed:", content);
      return DOUBAO_FALLBACK_ADVICE;
    }
  } catch (error) {
    console.error("[doubao-service] API call failed:", error);
    return DOUBAO_FALLBACK_ADVICE;
  }
}
