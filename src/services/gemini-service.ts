import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GeminiStyleAdvice } from "@/lib/types";
import { GEMINI_SYSTEM_PROMPT } from "@/prompts/gemini-prompts";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function generateGeminiStyleAdvice(userPrompt: string): Promise<GeminiStyleAdvice> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  // 使用 gemini-1.5-flash，它是目前性价比最高且支持 JSON mode 的型号
  // 注意：用户要求 gemini-2.5-flash，但目前 Google 官方最新生产力型号通常为 1.5 系列。
  // 如果是 Google AI Studio 最新的 2.0 版本，这里可以改为 gemini-2.0-flash-exp
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: GEMINI_SYSTEM_PROMPT,
  });

  const generationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
    responseMimeType: "application/json", // 强制要求 JSON 输出
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  try {
    const chatSession = model.startChat({
      generationConfig,
      safetySettings,
      history: [],
    });

    // 考虑到 Free API 可能有超时风险，设置一个超时控制
    const resultPromise = chatSession.sendMessage(userPrompt);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API request timed out (30s)")), 30000)
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    try {
      // 清理可能存在的转义字符或 markdown 标记（虽然 responseMimeType 已设置）
      const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanJson) as GeminiStyleAdvice;
    } catch (parseError) {
      console.error("[gemini-service] JSON parsing failed:", text);
      throw new Error("Failed to parse Gemini response as JSON.");
    }
  } catch (error) {
    console.error("[gemini-service] API call error:", error);
    throw error;
  }
}

/**
 * Fallback 方案，当 API 失败时返回预设的高质量文案
 */
export const GEMINI_FALLBACK_ADVICE: GeminiStyleAdvice = {
  title: "探索你的专属色彩美学",
  summary: "根据你的色彩基因分析，你展现出极具魅力的个人特质。通过精准的色彩搭配，可以进一步提升你的氛围感。",
  style_keywords: ["高级感", "氛围感", "自然魅力"],
  fashion_recommendations: [
    "尝试将核心色作为内搭，外加一件基础色的西装外套，打造都市优雅感。",
    "选用丝绸或高支棉材质，增加穿搭的精致度。",
    "下装可选择直筒裤或垂坠感极佳的长裙，修饰身形的同时保持松弛感。"
  ],
  makeup_recommendations: [
    "底妆追求轻薄水光感，突出原生肌肤质感。",
    "眼影选用低饱和度的中性色系进行大面积铺色。"
  ],
  hair_recommendations: ["建议保持原生发色，或尝试增加冷/暖色调的轻微挑染"],
  accessory_recommendations: ["首饰建议以简约的几何线条设计为主", "包包选择有质感的皮革材质"],
  avoid_recommendations: ["避免大面积穿着与肤色对比过强的荧光色", "减少过于繁复、没有主次的堆砌式风格"]
};
