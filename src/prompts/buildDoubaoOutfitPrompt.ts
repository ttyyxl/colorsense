import type { OutfitInspirationRequest } from "@/lib/outfit-types";
import type { UserStyleProfilePromptContext } from "@/lib/user-profile-types";

export function buildDoubaoOutfitUserPrompt(input: OutfitInspirationRequest): string {
  const weather = input.weather;
  const profile = input.profile.rawProfile?.promptContext?.promptFields;

  let userProfileText = "";
  if (profile) {
    userProfileText = `\n\n用户个人档案信息：\n` +
      `- 性别: ${profile.gender}\n` +
      `- 年龄段: ${profile.ageRange}\n` +
      `- 日常场景: ${profile.dailyScene}\n` +
      `- 肤色: ${profile.skinTone}\n` +
      `- 瞳色: ${profile.eyeColor}\n` +
      `- 发色: ${profile.hairColor}\n` +
      `- 脸型轮廓: ${profile.faceContour.join(", ")}\n` +
      `- 五官细节: ${profile.facialDetails.join(", ")}\n` +
      `- 皮肤与毛发对比: ${profile.skinHairContrast.join(", ")}\n` +
      `- 风格倾向: ${profile.styleTendency.join(", ")}\n` +
      `- 穿搭偏好: ${profile.stylePreferences.join(", ")}\n` +
      `- 妆容偏好: ${profile.makeupPreferences.join(", ")}\n` +
      (profile.favoriteColors && profile.favoriteColors.length > 0 ?
        `- 喜欢的颜色: ${profile.favoriteColors.join(", ")}\n` : "");
  }

  return `请根据以下信息，为用户生成一份个性化的今日 OOTD 穿搭建议报告：\n\n` +
    `# 用户输入\n` +
    `- 季型：${input.season}\n` +
    `- 场景：${input.scene === "daily" ? "日常" : "旅行"}\n` +
    `- 具体场合：${input.occasion}\n` +
    `- 今日心情：${input.mood}\n` +
    (weather ?
      `- 天气：${weather.city}，温度 ${weather.temperature}，天气状况 ${weather.condition}\n` : "") +
    (userProfileText ? userProfileText : "") +
    `\n# 任务要求\n` +
    `请严格按照 JSON 格式输出，包含以下字段：\n` +
    `- theme: 穿搭主题 (string)\n` +
    `- color_palette: 6个推荐颜色的HEX色值数组 (string[])\n` +
    `- item_recommendations: 具体单品推荐 (object，包含 top, bottom, outerwear, shoes, bag, accessories)\n` +
    `- makeup_advice: 妆容建议 (string)\n` +
    `- reason: 推荐理由 (string)\n` +
    `\n请注意：输出必须是纯 JSON，不要包含 Markdown 代码块标记。`;
}
