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
  ],
  "celebrity_recommendations": [
    "推荐特点类似的明星1",
    "推荐特点类似的明星2",
    "推荐特点类似的明星3"
  ]
}

注意：
- fashion_recommendations 至少3条
- celebrity_recommendations 至少3条
- 每条建议都要具体、可操作
- 必须包含推荐的颜色（使用色号或颜色名称）
- 必须提及应避免的颜色
- 保持小红书风格，语言生动但有专业感`;

const PROFILE_SYSTEM_PROMPT = `你是一个专业的个人形象顾问，擅长根据用户的详细信息生成全面的个人形象档案。
你不允许说你是AI。
你必须基于用户提供的个人信息总结，输出一份结构化的个人形象档案。
禁止营销语言。
请避免重复用户提供的信息，而是对其进行分析和解读，给出专业的形象建议。

你必须严格按照以下 JSON 格式输出，不要包含任何额外信息、解释或 Markdown 语法：

{
  "title": "个人形象档案标题（专业、吸引人）",
  "summary": "个人形象核心总结（约50-100字）",
  "personality_traits": ["性格特征1", "性格特征2", "性格特征3"],
  "style_essence": "形象风格精髓（一句话概括）",
  "wardrobe_suggestions": [
    "服装搭配建议1（基于问卷信息，提供具体风格、款式和颜色建议）",
    "服装搭配建议2",
    "服装搭配建议3"
  ],
  "color_palette_advice": [
    "适合的颜色1（结合肤色、瞳色、发色和喜好颜色，提供具体色系或颜色名称）",
    "适合的颜色2",
    "适合的颜色3"
  ],
  "makeup_hair_suggestions": [
    "妆容建议（结合五官细节和风格倾向）",
    "发型发色建议（结合脸型轮廓和发色）"
  ],
  "accessories_guidance": [
    "配饰选择建议（例如首饰、包包、眼镜等）"
  ],
  "overall_impression": "整体形象印象与提升方向"
}

注意：
- wardrobe_suggestions 至少3条
- color_palette_advice 至少3条
- 每条建议都要具体、可操作，且基于用户提供的问卷信息进行分析
- 必须包含推荐的颜色（使用色号或颜色名称）
- 保持专业、客观的语气。`;

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
  celebrity_recommendations: z.array(z.string()).optional(),
});

export const ProfileOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  personality_traits: z.array(z.string()),
  style_essence: z.string(),
  wardrobe_suggestions: z.array(z.string()),
  color_palette_advice: z.array(z.string()),
  makeup_hair_suggestions: z.array(z.string()),
  accessories_guidance: z.array(z.string()),
  overall_impression: z.string(),
});

export type AiOutput = z.infer<typeof AiOutputSchema>;
export type DoubaoStyleAdvice = AiOutput;
export type ProfileOutput = z.infer<typeof ProfileOutputSchema>;

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
  celebrity_recommendations: [],
};

const FALLBACK_RESPONSE = {
  ...FALLBACK_JSON_TEMPLATE,
  source: "fallback",
};
export const FALLBACK_ADVICE = FALLBACK_RESPONSE;

const PROFILE_FALLBACK_JSON_TEMPLATE = {
  title: "您的专属形象档案初探",
  summary: "根据您的初步信息，我们为您构建了基础形象档案。进一步的分析将帮助您更深入了解个人风格。",
  personality_traits: ["内敛", "时尚", "自然"],
  style_essence: "简约而富有质感",
  wardrobe_suggestions: [
    "推荐尝试经典款式的服装，如合身的衬衫、西裤和A字裙，以展现您的专业与优雅。",
    "色彩选择上，建议以中性色为主，如米白、灰色、海军蓝，点缀少量亮色提升活力。",
    "注重服装的面料和剪裁，选择垂坠感好、不易起皱的材质，提升整体质感。",
  ],
  color_palette_advice: [
    "根据您的肤色，建议选择冷色调或暖色调的柔和色彩，如雾霾蓝、豆沙绿或焦糖色。",
    "避免过于饱和或荧光的颜色，以免喧宾夺主，影响您的自然气质。",
    "可以尝试同色系搭配，通过深浅变化打造层次感，使造型更显高级。",
  ],
  makeup_hair_suggestions: [
    "妆容宜清淡自然，突出眼部或唇部一处重点，例如选择大地色眼影和裸色系唇膏。",
    "发型建议以简洁大方为主，例如低马尾、法式盘发或微卷长发，能够凸显您的气质。",
  ],
  accessories_guidance: [
    "配饰选择上，以精致小巧为主，例如珍珠耳环、细链项链或经典款手表。",
  ],
  overall_impression: "您的形象给人一种内敛、知性的感觉，通过合理的穿搭和妆发可以进一步提升您的专业度和亲和力。",
};

const PROFILE_FALLBACK_RESPONSE = {
  ...PROFILE_FALLBACK_JSON_TEMPLATE,
  source: "fallback",
};

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

export async function generateProfileAdvice(userProfileSummary: string): Promise<ProfileOutput & { source: "doubao" | "fallback" }> {
  const openai = new OpenAI({
    apiKey: DOUBAO_API_KEY,
    baseURL: DOUBAO_BASE_URL,
  });

  const userPrompt = `用户个人形象问卷总结如下：\n${userProfileSummary}\n\n请根据以上信息，为用户生成一份全面的个人形象档案，并严格按照指定的 JSON 格式输出。`;

  console.log("[doubao-profile-request]", userPrompt);

  try {
    const response = await openai.chat.completions.create({
      model: DOUBAO_MODEL,
      messages: [
        { role: "system", content: PROFILE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    console.log("[doubao-profile-response]", content);

    if (!content) {
      console.error("[doubao-profile-service] Doubao API 返回空内容，使用 fallback。");
      return PROFILE_FALLBACK_RESPONSE as ProfileOutput & { source: "fallback" };
    }

    try {
      const cleanJson = content.replace(/```json\n?|\\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const validatedOutput = ProfileOutputSchema.parse(parsed);
      console.log("[ai-profile-source]", "doubao");
      return { ...validatedOutput, source: "doubao" };
    } catch (parseError) {
      console.error("[doubao-profile-service] JSON 解析或校验失败，内容：", content, "错误：", parseError);
      return PROFILE_FALLBACK_RESPONSE as ProfileOutput & { source: "fallback" };
    }
  } catch (error) {
    console.error("[doubao-profile-service] Doubao API 调用失败，错误：", error);
    return PROFILE_FALLBACK_RESPONSE as ProfileOutput & { source: "fallback" };
  }
}