import { z } from "zod";

export const OutfitAiOutputSchema = z.object({
  theme: z.string().describe("穿搭主题，小红书风格，带emoji更佳"),
  color_palette: z.array(z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)).length(6).describe("6个推荐颜色的HEX色值数组"),
  item_recommendations: z.object({
    top: z.string().describe("上衣推荐"),
    bottom: z.string().describe("下装推荐"),
    outerwear: z.string().describe("外套推荐"),
    shoes: z.string().describe("鞋子推荐"),
    bag: z.string().describe("包包推荐"),
    accessories: z.string().describe("配饰推荐"),
  }).describe("单品推荐"),
  makeup_advice: z.string().describe("妆容建议"),
  reason: z.string().describe("推荐理由，解释为什么这样搭配，结合用户偏好、天气、场景等"),
});

export type OutfitAiOutput = z.infer<typeof OutfitAiOutputSchema>;
