import { z } from "zod";

/**
 * Doubao 视觉诊断的结构化输出契约。
 * 该模块不信任模型生成的 JSON：所有字段都要经过枚举、范围、有限性与跨字段一致性校验。
 * 下一阶段的融合模块（fusion.ts）应直接消费这里导出的 VisionResult / SeasonScores 类型。
 */

/** 未来融合模块使用的统一四季型顺序。 */
export const SEASON_KEYS = ["spring", "summer", "autumn", "winter"] as const;
export type SeasonKey = (typeof SEASON_KEYS)[number];

/** 允许模型输出的总分偏差；在容差内由本地归一化到精确 1，超出则拒绝。 */
export const SEASON_SCORE_SUM_TOLERANCE = 0.1;
/** 比较最大评分时使用的浮点容差。 */
const SCORE_EPSILON = 1e-9;
/** reason 的长度上限，防止异常长文本进入日志或后续流程。 */
export const REASON_MAX_LENGTH = 600;

const unitScore = z.number().finite().min(0).max(1);

export const SeasonScoresSchema = z.object({
  spring: unitScore,
  summer: unitScore,
  autumn: unitScore,
  winter: unitScore,
});

export const SkinUndertoneSchema = z.enum(["warm", "cool", "neutral", "unknown"]);
export const BrightnessSchema = z.enum(["light", "medium", "dark", "unknown"]);
export const SaturationSchema = z.enum(["soft", "moderate", "vivid", "unknown"]);
export const FeatureContrastSchema = z.enum(["low", "medium", "high", "unknown"]);

/** 模型原始响应结构（尚未做总分归一化与跨字段一致性检查）。 */
export const VisionAnalysisRawSchema = z
  .object({
    season_scores: SeasonScoresSchema,
    most_likely_season: z.enum(SEASON_KEYS),
    skin_undertone: SkinUndertoneSchema,
    brightness: BrightnessSchema,
    saturation: SaturationSchema,
    feature_contrast: FeatureContrastSchema,
    lighting_warning: z.boolean(),
    filter_warning: z.boolean(),
    can_judge_reliably: z.boolean(),
    reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
  })
  .strict();

/**
 * 严格校验后的结果。总分会被归一化到 1（保留 6 位小数），
 * 且 most_likely_season 必须对应归一化前的最大评分。
 */
export const VisionResultSchema = VisionAnalysisRawSchema.superRefine((value, ctx) => {
  const sum = SEASON_KEYS.reduce((acc, key) => acc + value.season_scores[key], 0);

  if (!Number.isFinite(sum) || sum <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["season_scores"],
      message: "season_scores must have a positive finite sum",
    });
    return;
  }

  if (Math.abs(sum - 1) > SEASON_SCORE_SUM_TOLERANCE) {
    ctx.addIssue({
      code: "custom",
      path: ["season_scores"],
      message: `season_scores sum must be within ${SEASON_SCORE_SUM_TOLERANCE} of 1`,
    });
  }

  const maxScore = Math.max(...SEASON_KEYS.map((key) => value.season_scores[key]));
  const winners = SEASON_KEYS.filter(
    (key) => Math.abs(value.season_scores[key] - maxScore) <= SCORE_EPSILON,
  );
  if (!winners.includes(value.most_likely_season)) {
    ctx.addIssue({
      code: "custom",
      path: ["most_likely_season"],
      message: "most_likely_season must match the highest season score",
    });
  }

  if (!value.can_judge_reliably && value.reason.length < 6) {
    ctx.addIssue({
      code: "custom",
      path: ["reason"],
      message: "reason must briefly explain why the image is not reliable",
    });
  }
}).transform((value) => {
  const sum = SEASON_KEYS.reduce((acc, key) => acc + value.season_scores[key], 0);
  const scores = {} as Record<SeasonKey, number>;
  for (const key of SEASON_KEYS) {
    scores[key] = Math.round((value.season_scores[key] / sum) * 1e6) / 1e6;
  }

  // 修正四舍五入造成的尾差，把差额补给原最高分，保证四项之和精确为 1。
  const normalizedSum = SEASON_KEYS.reduce((acc, key) => acc + scores[key], 0);
  const drift = Math.round((1 - normalizedSum) * 1e6) / 1e6;
  if (drift !== 0) {
    scores[value.most_likely_season] =
      Math.round((scores[value.most_likely_season] + drift) * 1e6) / 1e6;
  }

  return { ...value, season_scores: scores };
});

export type SeasonScores = z.infer<typeof SeasonScoresSchema>;
export type SkinUndertone = z.infer<typeof SkinUndertoneSchema>;
export type Brightness = z.infer<typeof BrightnessSchema>;
export type Saturation = z.infer<typeof SaturationSchema>;
export type FeatureContrast = z.infer<typeof FeatureContrastSchema>;
export type VisionAnalysisRaw = z.infer<typeof VisionAnalysisRawSchema>;
export type VisionResult = z.infer<typeof VisionResultSchema>;

/**
 * 火山方舟 structured outputs 使用的 JSON Schema。
 * 必须与上面的 Zod 结构保持一致；Zod 仍然负责最终的本地校验。
 */
export const VISION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    season_scores: {
      type: "object",
      additionalProperties: false,
      description: "四季型的相对匹配评分，非统计概率；四项之和约等于 1。",
      properties: {
        spring: { type: "number", minimum: 0, maximum: 1 },
        summer: { type: "number", minimum: 0, maximum: 1 },
        autumn: { type: "number", minimum: 0, maximum: 1 },
        winter: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [...SEASON_KEYS],
    },
    most_likely_season: {
      type: "string",
      enum: [...SEASON_KEYS],
      description: "与最高分对应的季型。",
    },
    skin_undertone: {
      type: "string",
      enum: ["warm", "cool", "neutral", "unknown"],
    },
    brightness: { type: "string", enum: ["light", "medium", "dark", "unknown"] },
    saturation: { type: "string", enum: ["soft", "moderate", "vivid", "unknown"] },
    feature_contrast: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    lighting_warning: { type: "boolean" },
    filter_warning: { type: "boolean" },
    can_judge_reliably: { type: "boolean" },
    reason: {
      type: "string",
      minLength: 1,
      maxLength: REASON_MAX_LENGTH,
      description: "先写可观察特征，再写推断结论；拒判时说明原因。",
    },
  },
  required: [
    "season_scores",
    "most_likely_season",
    "skin_undertone",
    "brightness",
    "saturation",
    "feature_contrast",
    "lighting_warning",
    "filter_warning",
    "can_judge_reliably",
    "reason",
  ],
} as const;

/** 只返回出错字段名/路径，不返回模型原文或字段值，避免敏感内容进入日志。 */
export function describeSchemaIssues(error: z.ZodError): string[] {
  return error.issues.flatMap((issue) => {
    // Zod 4 的多余字段错误把键名放在 keys 中，path 为空。
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => String(key));
    }
    return [issue.path.length > 0 ? issue.path.map(String).join(".") : "<root>"];
  });
}
