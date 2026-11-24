import type { SeasonType } from "./seasons.ts";
import {
  buildFusionDiagnosis,
  type CnnFusionInput,
  type DoubaoFusionInput,
  type FusionDiagnosis,
  type FusionUnavailableCode,
} from "./fusion.ts";
import type { SeasonKey, SeasonScores } from "./vision-schema.ts";
import { logVisionDiagnostics } from "./vision-diagnostics.ts";

/**
 * /api/diagnose 与综合结果之间的纯适配层。
 * 路由和测试共用这里的组装逻辑，保证接口返回值与 Firestore 记录来自同一个结果对象。
 */

export interface LegacySeasonFields {
  seasonType: SeasonKey;
  confidence: number;
  scores?: Partial<Record<SeasonType, number>>;
}

export interface AssembleDiagnosisInput {
  fusionEnabled: boolean;
  cnnWeight?: number;
  cnn: CnnFusionInput | null;
  doubao: DoubaoFusionInput | null;
  cnnCode?: FusionUnavailableCode;
  doubaoCode?: FusionUnavailableCode;
  legacy: LegacySeasonFields;
}

export interface AssembledDiagnosisFields {
  seasonType: SeasonKey;
  confidence: number;
  scores?: Partial<Record<SeasonType, number>> | SeasonScores;
  fusionDiagnosis?: FusionDiagnosis;
}

/**
 * FUSION_ENABLED=false 时逐字段保留第一阶段行为。
 * 启用后顶层 seasonType / confidence / scores 全部取自综合结果，避免与新字段矛盾。
 * 此时 confidence 的含义是「top-1 融合分数」，不是经过概率校准的置信度。
 */
export function assembleDiagnosisFields(input: AssembleDiagnosisInput): AssembledDiagnosisFields {
  if (!input.fusionEnabled) {
    return {
      seasonType: input.legacy.seasonType,
      confidence: input.legacy.confidence,
      ...(input.legacy.scores === undefined ? {} : { scores: input.legacy.scores }),
    };
  }

  const fusionDiagnosis = buildFusionDiagnosis({
    cnn: input.cnn,
    doubao: input.doubao,
    cnnWeight: input.cnnWeight,
    cnnCode: input.cnnCode,
    doubaoCode: input.doubaoCode,
  });

  // 只记录机器可读的结果来源与原因码；不记录季型分数、用户画像或任何自然语言内容。
  logVisionDiagnostics("fusion.result", {
    fusionEnabled: true,
    cnnWeight: fusionDiagnosis.requestedWeights.cnn,
    source: fusionDiagnosis.source,
    fallbackReason: fusionDiagnosis.fallbackReason,
  });

  return {
    seasonType: fusionDiagnosis.predictedSeason,
    confidence: fusionDiagnosis.seasonScores[fusionDiagnosis.predictedSeason],
    scores: fusionDiagnosis.seasonScores,
    fusionDiagnosis,
  };
}

/** 构造 Firestore 记录；可选字段缺失时不写入 undefined，历史字段保持不变。 */
export function buildDiagnosisRecord<T extends Record<string, unknown>>(
  fields: AssembledDiagnosisFields,
  extras: T,
) {
  const { scores, fusionDiagnosis, ...requiredFields } = fields;
  return {
    ...requiredFields,
    ...(scores === undefined ? {} : { scores }),
    ...(fusionDiagnosis === undefined ? {} : { fusionDiagnosis }),
    ...extras,
  };
}
