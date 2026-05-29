import OpenAI from "openai";
import { z } from "zod";

// --- Doubao 配置 ---
const DOUBAO_API_KEY = "ark-df3720c0-0027-4cf1-9535-793826c8f74e-6aa66";
const DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_MODEL = "doubao-seed-2-0-pro-260215";

// --- System Prompt ---
// src/lib/ai.ts

const DOUBAO_SYSTEM_PROMPT = `你是一个小红书风格的专业色彩穿搭顾问。
你不允许说你是AI。
你必须基于用户的季型分析结果输出穿搭建议。
禁止营销语言。
禁止重复季型名称。

你必须严格按照以下 JSON 格式输出，不要包含任何额外信息、解释或 Markdown 语法：

{
  "title": "吸引人的标题（小红书风格，带emoji更佳）",
  "summary": "一句话总结穿搭核心理念（约50字）",
  "style_keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "fashion_recommendations": [
    "具体的服装搭配建议1（包含颜色、款式、搭配方式）",
    "具体的服装搭配建议2",
    "具体的服装搭配建议3"
  ],
  "makeup_recommendations": [
    "底妆建议",
    "眼妆建议",
    "唇妆建议"
  ],
  "hair_recommendations": [
    "发色建议",
    "发型建议"
  ],
  "accessory_recommendations": [
    "首饰建议",
    "包包建议",
    "其他配饰建议"
  ],
  "avoid_recommendations": [
    "需要避免的颜色或款式1",
    "需要避免的颜色或款式2",
    "需要避免的颜色或款式3"
  ]
}

注意：
- fashion_recommendations 至少3条
- 每条建议都要具体、可操作
- 必须包含推荐的颜色（使用色号或颜色名称）
- 必须提及应避免的颜色
- 保持小红书风格，语言生动但有专业感`;

// --- 输出 Schema 校验 ---
export const AiOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  style_keywords: z.array(z.string()),
  fashion_recommendations: z.array(z.string()),
  makeup_recommendations: z.array(z.string()),
  hair_recommendations: z.array(z.string()),
  accessory_recommendations: z.array(z.string()),
  avoid_recommendations: z.array(z.string()),
});

export type AiOutput = z.infer<typeof AiOutputSchema>;

// --- Fallback JSON 模板 ---
const FALLBACK_JSON_TEMPLATE = {
  title: "探索你的原生色彩魅力",
  summary: "每个人都有独特的色彩基因，通过科学的诊断，我们能帮你找到最能衬托肤色、提升气质的专属色彩方案。本次结果为通用建议，期待下次更精准的分析。",
  style_keywords: ["自然系", "高级感", "氛围感"],
  fashion_recommendations: [
    "建议尝试以柔和的基础色作为主基调，搭配核心色作为局部点缀，如米白、燕麦色与焦糖色的组合。",
    "选择亲肤且有垂坠感的天然面料，如丝绸、羊绒或精梳棉，提升整体质感。",
    "利用同色系叠穿打造层次感，让整体造型更有深度，例如不同深浅的蓝色系搭配。",
  ],
  makeup_recommendations: [
    "保持底妆的清透感，追求‘妈生好皮’的自然光泽，避免厚重妆感。",
    "选用提升气色的低饱和度唇彩，如肉桂色、豆沙色或干燥玫瑰色，与肤色自然融合。",
    "眼妆部分可选择大地色系或与瞳色相近的暖棕色，营造深邃感而不失柔和。",
  ],
  hair_recommendations: [
    "建议保持原生发色的质感，或选择更贴合肤色冷暖的自然棕调，避免过于鲜艳或极端的发色。",
    "蓬松的微卷发或干净的直发都能很好地营造出松弛感和自然美，避免过于刻板的发型。",
  ],
  accessory_recommendations: [
    "根据肤色冷暖选择金饰或银饰，简约的几何线条设计更显高级，避免过于繁复的款式。",
    "包包建议选择质感皮革材质，与服装整体色调呼应，或者选择经典款提升品味。",
    "丝巾和帽子也是提升造型感的利器，选择与服装主色调协调的款式。",
  ],
  avoid_recommendations: [
    "避免大面积穿着与肤色对比过于强烈的荧光色或高饱和度色，以免显得突兀。",
    "减少过于繁琐、没有视觉重心的堆砌式设计，保持整体造型的简洁和流畅。",
    "谨慎选择带有大面积图案或复杂印花的单品，容易分散视觉焦点。",
  ],
};

const FALLBACK_RESPONSE = {
  ...FALLBACK_JSON_TEMPLATE,
  source: "fallback",
};
export const FALLBACK_ADVICE = FALLBACK_RESPONSE;

export async function generateStyleAdvice(input: {
  season: string;
  confidence: number;
  lab_features: { L: number; a: number; b: number };
  recommended_colors: string[];
  avoid_colors: string[];
  keywords: string[];
}): Promise<AiOutput & { source: "doubao" | "fallback" }> {
  const openai = new OpenAI({
    apiKey: DOUBAO_API_KEY,
    baseURL: DOUBAO_BASE_URL,
  });

  const userPrompt = `用户季型分析结果如下：\n季型：${input.season}\n置信度：${input.confidence.toFixed(2)}\nLAB肤色特征：L=${input.lab_features.L.toFixed(2)}, a=${input.lab_features.a.toFixed(2)}, b=${input.lab_features.b.toFixed(2)}\n推荐颜色：${input.recommended_colors.join(", ")}\n避免颜色：${input.avoid_colors.join(", ")}\n用户提供的关键词：${input.keywords.join(", ")}\n\n请根据以上信息，为用户生成一份详细的色彩穿搭建议，并严格按照指定的 JSON 格式输出。`;

  console.log("[doubao-request]", userPrompt);

  try {
    const response = await openai.chat.completions.create({
      model: DOUBAO_MODEL,
      messages: [
        { role: "system", content: DOUBAO_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    console.log("[doubao-response]", content);

    if (!content) {
      console.error("[doubao-service] Doubao API 返回空内容，使用 fallback。");
      return FALLBACK_RESPONSE as AiOutput & { source: "fallback" };
    }

    try {
      // 尝试清理可能存在的 Markdown 代码块
      const cleanJson = content.replace(/```json\n?|\\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const validatedOutput = AiOutputSchema.parse(parsed);
      console.log("[ai-source]", "doubao");
      return { ...validatedOutput, source: "doubao" };
    } catch (parseError) {
      console.error("[doubao-service] JSON 解析或校验失败，内容：", content, "错误：", parseError);
      return FALLBACK_RESPONSE as AiOutput & { source: "fallback" };
    }
  } catch (error) {
    console.error("[doubao-service] Doubao API 调用失败，错误：", error);
    return FALLBACK_RESPONSE as AiOutput & { source: "fallback" };
  }
}
export const generateDoubaoStyleAdvice = generateStyleAdvice;