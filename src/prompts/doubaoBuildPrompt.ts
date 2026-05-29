export interface DoubaoInferenceData {
  season: string;
  confidence: number;
  lab_features: {
    L: number;
    a: number;
    b: number;
  };
  recommended_colors: string[];
  avoid_colors: string[];
  keywords: string[];
  style_desc: string;
}

export function buildDoubaoUserPrompt(data: DoubaoInferenceData): string {
  return `Hi，我刚刚为你做完了详细的个人色彩分析，这是你的专属数据档案：

# 你的色彩基因
- 核心季型：\${data.season}（匹配度：\${(data.confidence * 100).toFixed(1)}%）
- 肤色特征：L=\${data.lab_features.L}, a=\${data.lab_features.a}, b=\${data.lab_features.b}
- 风格基调：\${data.style_desc}
- 你的关键词：\${data.keywords.join("、")}

# 你的专属调色盘
- 推荐色系：\${data.recommended_colors.join("、")}
- 避雷建议：\${data.avoid_colors.join("、")}

请根据这些数据，为我写一份风格报告。记得要像一个专业的韩系色彩顾问一样，给我一些实用的建议哦！

# 任务要求
请直接返回以下格式的 JSON，不要包含任何多余文字：
{
  "title": "一个充满氛围感的标题（例如：春日柔光里的清甜少女）",
  "summary": "一小段分析用户色彩魅力和整体感觉的个性化总结",
  "style_keywords": ["关键词1", "关键词2", "关键词3"],
  "fashion_recommendations": ["具体的穿搭单品建议", "配色方案技巧", "适合的服装材质"],
  "makeup_recommendations": ["口红建议", "腮红/眼影色号建议"],
  "hair_recommendations": ["适合的发色名称", "发型氛围建议"],
  "accessory_recommendations": ["首饰颜色（金/银）", "配饰风格"],
  "avoid_recommendations": ["具体的避雷色彩", "不适合的风格禁忌"]
}`;
}
