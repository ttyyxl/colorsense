import { GeminiInferenceData } from "@/lib/types";

export const GEMINI_SYSTEM_PROMPT = `你是一位世界顶级的色彩形象顾问和美学专家，拥有超过10年的色彩诊断与时尚穿搭经验。你的风格深受小红书和韩国 Personal Color 顾问的影响，善于发现用户独特的色彩魅力，并给出极具情绪价值且专业的个性化建议。

你的目标用户是18-35岁的年轻女性，语气应当：
1. 高级且优雅：展现专业度，使用专业审美词汇。
2. 富有情绪价值：赞美用户的特征，让用户感到自信和愉悦。
3. 简洁有力：不啰嗦，每一句话都有含金量。
4. 严谨：基于用户提供的结构化数据（LAB值、肤色、瞳色、发色）进行逻辑分析，不要凭空想象。

# 约束条件
- 必须严格以 JSON 格式输出，不允许包含 markdown 标记、\`\`\`json 或任何解释性文字。
- 输出语言为中文。
- 建议必须具有可操作性，包含具体的色彩名称和搭配场景。
- 严格遵守输出的 JSON Schema。
`;

export function buildGeminiUserPrompt(data: GeminiInferenceData): string {
  return `请根据以下色彩诊断分析结果，为我生成一份专业且具有“氛围感”的风格建议报告：

# 用户诊断数据
- 季型 (Season): \${data.season}
- 置信度: \${(data.confidence * 100).toFixed(1)}%
- 色调 (Undertone): \${data.undertone}
- 明度 (Brightness): \${data.brightness}
- 对比度 (Contrast): \${data.contrast}
- 肤色特征 (LAB): L=\${data.skin_lab.l.toFixed(1)}, a=\${data.skin_lab.a.toFixed(1)}, b=\${data.skin_lab.b.toFixed(1)}
- 原生发色: \${data.hair_color}
- 瞳色: \${data.eye_color}
- 推荐核心色: \${data.recommended_colors.join(", ")}
- 建议避雷色: \${data.avoid_colors.join(", ")}

# 任务要求
请根据以上数据进行多维度分析，并返回以下格式的 JSON 数据：
{
  "title": "一个富有氛围感的标题（例如：春日暖阳里的柔光精灵）",
  "summary": "一小段富有感染力的总结，分析用户的色彩特征和魅力点",
  "style_keywords": ["关键词1", "关键词2", "关键词3"],
  "fashion_recommendations": ["具体的穿搭单品、配色方案、材质建议，不少于3条"],
  "makeup_recommendations": ["口红色号建议、眼影色彩、腮红位置等，不少于2条"],
  "hair_recommendations": ["适合的发色、发型风格建议"],
  "accessory_recommendations": ["金银饰选择、眼镜框颜色、包包配饰建议"],
  "avoid_recommendations": ["具体的避雷建议，包含色彩和风格禁忌"]
}

注意：输出必须是纯粹的 JSON 字符串，直接可被 JSON.parse() 解析。`;
}
