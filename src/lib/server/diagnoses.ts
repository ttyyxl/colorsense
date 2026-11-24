import type { DoubaoStyleAdvice } from "@/lib/ai";
import type { AiAdvice, Diagnosis, LabFeatures, NewDiagnosis } from "@/lib/types";
import type { SeasonType } from "@/lib/seasons";
import { byId, byUser, pgDelete, pgInsert, pgSelect, pgSelectOne, type Filter } from "./pg";

const TABLE = "cs_diagnoses";

export interface DiagnosisRow {
  id: string;
  user_id: string;
  season_type: string;
  confidence: number;
  color_palette: string[] | null;
  style_keywords: string[] | null;
  avoid_colors: string[] | null;
  ai_description: string;
  lab_features: LabFeatures | null;
  source: string;
  scores: Partial<Record<SeasonType, number>> | null;
  face_detected: boolean | null;
  used_original_image: boolean | null;
  face_confidence: number | null;
  ai_advice: AiAdvice | null;
  doubao_advice: DoubaoStyleAdvice | null;
  fusion_diagnosis: Diagnosis["fusionDiagnosis"] | null;
  diagnosis_status: Diagnosis["diagnosisStatus"] | null;
  inference_mode: Diagnosis["inferenceMode"] | null;
  uncertainty_reasons: string[] | null;
  risks: Diagnosis["risks"] | null;
  decisive_reasons: string[] | null;
  soft_warnings: string[] | null;
  recommendations: string[] | null;
  has_valid_season_result: boolean | null;
  created_at: string;
}

export function toDiagnosis(row: DiagnosisRow): Diagnosis {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    seasonType: row.season_type as SeasonType,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    colorPalette: row.color_palette ?? [],
    styleKeywords: row.style_keywords ?? [],
    avoidColors: row.avoid_colors ?? [],
    aiDescription: row.ai_description ?? "",
    labFeatures: row.lab_features ?? { L: 0, a: 0, b: 0 },
    source: (row.source as Diagnosis["source"]) ?? "model",
    ...(row.scores ? { scores: row.scores } : {}),
    ...(row.face_detected === null ? {} : { faceDetected: row.face_detected }),
    ...(row.used_original_image === null ? {} : { usedOriginalImage: row.used_original_image }),
    ...(row.face_confidence === null ? {} : { faceConfidence: row.face_confidence }),
    ...(row.ai_advice ? { aiAdvice: row.ai_advice } : {}),
    ...(row.doubao_advice ? { doubaoAdvice: row.doubao_advice } : {}),
    ...(row.fusion_diagnosis ? { fusionDiagnosis: row.fusion_diagnosis } : {}),
    ...(row.diagnosis_status ? { diagnosisStatus: row.diagnosis_status } : {}),
    ...(row.inference_mode ? { inferenceMode: row.inference_mode } : {}),
    ...(row.uncertainty_reasons ? { uncertaintyReasons: row.uncertainty_reasons } : {}),
    ...(row.risks ? { risks: row.risks } : {}),
    ...(row.decisive_reasons ? { decisiveReasons: row.decisive_reasons } : {}),
    ...(row.soft_warnings ? { softWarnings: row.soft_warnings } : {}),
    ...(row.recommendations ? { recommendations: row.recommendations } : {}),
    ...(typeof row.has_valid_season_result === "boolean"
      ? { hasValidSeasonResult: row.has_valid_season_result }
      : {}),
  };
}

export function buildDiagnosisInsert(userId: string, input: NewDiagnosis) {
  return {
    user_id: userId,
    season_type: input.seasonType,
    confidence: input.confidence,
    color_palette: input.colorPalette ?? [],
    style_keywords: input.styleKeywords ?? [],
    avoid_colors: input.avoidColors ?? [],
    ai_description: input.aiDescription ?? "",
    lab_features: input.labFeatures ?? null,
    source: input.source,
    scores: input.scores ?? null,
    face_detected: input.faceDetected ?? null,
    used_original_image: input.usedOriginalImage ?? null,
    face_confidence: input.faceConfidence ?? null,
    ai_advice: input.aiAdvice ?? null,
    doubao_advice: input.doubaoAdvice ?? null,
    fusion_diagnosis: input.fusionDiagnosis ?? null,
    diagnosis_status: input.diagnosisStatus ?? null,
    inference_mode: input.inferenceMode ?? null,
    uncertainty_reasons: input.uncertaintyReasons ?? null,
    risks: input.risks ?? null,
    decisive_reasons: input.decisiveReasons ?? null,
    soft_warnings: input.softWarnings ?? null,
    recommendations: input.recommendations ?? null,
    has_valid_season_result: input.hasValidSeasonResult ?? null,
  };
}

export async function createDiagnosis(userId: string, input: NewDiagnosis): Promise<string> {
  const rows = await pgInsert<{ id: string }>(
    TABLE,
    buildDiagnosisInsert(userId, input),
    { select: "id" },
  );

  return rows[0]?.id ?? "";
}

export async function listUserDiagnoses(userId: string): Promise<Diagnosis[]> {
  const rows = await pgSelect<DiagnosisRow>(TABLE, {
    filters: [byUser(userId)],
    order: "created_at.desc",
  });
  return rows.map(toDiagnosis);
}

export async function getUserDiagnosis(id: string, userId: string): Promise<Diagnosis | null> {
  const row = await pgSelectOne<DiagnosisRow>(TABLE, { filters: byId(id) });
  if (!row || row.user_id !== userId) {
    return null;
  }
  return toDiagnosis(row);
}

export async function deleteUserDiagnosis(id: string, userId: string): Promise<void> {
  const deletion = await pgDelete<{ id: string }>(TABLE, [...byId(id), byUser(userId)]);
  if (deletion.length === 0) {
    throw new Error("无法删除不属于当前用户的记录。");
  }
}

export type BatchDeleteFailureReason = "not_found" | "forbidden" | "invalid_id" | "delete_failed";

export interface BatchDeleteResult {
  deletedIds: string[];
  failed: { id: string; reason: BatchDeleteFailureReason }[];
}

export async function deleteUserDiagnoses(ids: string[], userId: string): Promise<BatchDeleteResult> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
  if (uniqueIds.length === 0) {
    return { deletedIds: [], failed: [] };
  }

  const ownershipFilter: Filter = ["id", "in", `(${uniqueIds.join(",")})`];
  const owned = await pgSelect<{ id: string }>(TABLE, {
    select: "id",
    filters: [ownershipFilter, (["user_id", "eq", userId] as Filter)],
  });
  const ownedIds = new Set(owned.map((row) => row.id));

  const failed: { id: string; reason: BatchDeleteFailureReason }[] = [];
  const deletable = uniqueIds.filter((id) => {
    if (ownedIds.has(id)) {
      return true;
    }
    failed.push({ id, reason: "not_found" });
    return false;
  });

  let deletedIds: string[] = [];
  if (deletable.length > 0) {
    const deleted = await pgDelete<{ id: string }>(TABLE, [
      ["id", "in", `(${deletable.join(",")})`],
      ["user_id", "eq", userId],
    ]);
    deletedIds = deleted.map((row) => row.id);
    const deletedSet = new Set(deletedIds);
    for (const id of deletable) {
      if (!deletedSet.has(id)) {
        failed.push({ id, reason: "delete_failed" });
      }
    }
  }

  return { deletedIds, failed };
}
