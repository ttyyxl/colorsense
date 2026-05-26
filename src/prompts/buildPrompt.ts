import { SeasonType } from "@/lib/seasons";

interface DiagnosisData {
  seasonType: SeasonType;
  confidence: number;
  labFeatures: {
    L: number;
    a: number;
    b: number;
  };
  styleKeywords: string[];
}

export function buildUserPrompt(data: DiagnosisData): string {
  return "请根据以下色彩诊断数据，为用户生成一份个性化的穿搭建议报告：\n\n" +
    "# 诊断数据\n" +
    "- 色彩季型：" + data.seasonType + "\n" +
    "- 置信度：" + (data.confidence * 100).toFixed(1) + "%\n" +
    "- 肤色特征 (LAB)：L=" + data.labFeatures.L.toFixed(1) + ", a=" + data.labFeatures.a.toFixed(1) + ", b=" + data.labFeatures.b.toFixed(1) + "\n" +
    "- 风格关键词：" + data.styleKeywords.join(", ") + "\n\n" +
    "# 任务要求\n" +
    "请返回以下格式的 JSON 数据：\n" +
    "{\n" +
    '  "summary": "一句话总结用户的色彩魅力",\n' +
    '  "clothing": {\n' +
    '    "colors": ["建议使用的具体颜色名称"],\n' +
    '    "advice": "关于服装搭配的专业建议"\n' +
    "  },\n" +
    '  "makeup": {\n' +
    '    "advice": "关于妆容或配饰的色彩建议"\n' +
    "  },\n" +
    '  "avoid": "需要避雷的色彩或风格建议"\n' +
    "}\n\n" +
    "请注意：输出必须是纯 JSON，不要包含 Markdown 代码块标记。";
}
