import type { SeasonType } from "./seasons";
import { DIAGNOSIS_BUCKET, createSupabaseAdmin } from "./supabase-admin";

// Deprecated legacy persistence retained only for migration reference.
interface LegacyDiagnosis {
  id: string;
  user_id?: string;
  created_at: string;
  image_url?: string;
  image_name?: string;
  season_type: SeasonType;
  confidence: number;
  lab_features: { L: number; a: number; b: number };
  color_palette: string[];
  style_keywords: string[];
  ai_description: string;
  scores?: Partial<Record<SeasonType, number>>;
}

type DiagnosisRow = {
  id: string;
  user_id: string | null;
  created_at: string;
  image_url: string | null;
  image_name: string | null;
  season_type: SeasonType;
  confidence: number;
  lab_features: LegacyDiagnosis["lab_features"];
  color_palette: string[];
  style_keywords: string[];
  ai_description: string;
  scores: LegacyDiagnosis["scores"] | null;
};

export type NewDiagnosisInput = Omit<LegacyDiagnosis, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

function toDiagnosis(row: DiagnosisRow): LegacyDiagnosis {
  return {
    id: row.id,
    user_id: row.user_id ?? undefined,
    created_at: row.created_at,
    image_url: row.image_url ?? undefined,
    image_name: row.image_name ?? undefined,
    season_type: row.season_type,
    confidence: row.confidence,
    lab_features: row.lab_features,
    color_palette: row.color_palette,
    style_keywords: row.style_keywords,
    ai_description: row.ai_description,
    scores: row.scores ?? undefined,
  };
}

function getFileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/heic" || file.type === "image/heif") {
    return "heic";
  }

  return "jpg";
}

export async function uploadDiagnosisImage(file: File, diagnosisId: string) {
  const supabase = createSupabaseAdmin();
  const extension = getFileExtension(file);
  const storagePath = `${diagnosisId}/original.${extension}`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage.from(DIAGNOSIS_BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(DIAGNOSIS_BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}

export async function insertDiagnosis(input: NewDiagnosisInput) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("diagnoses")
    .insert({
      id: input.id,
      user_id: input.user_id ?? null,
      image_url: input.image_url ?? null,
      image_name: input.image_name ?? null,
      season_type: input.season_type,
      confidence: input.confidence,
      lab_features: input.lab_features,
      color_palette: input.color_palette,
      style_keywords: input.style_keywords,
      ai_description: input.ai_description,
      scores: input.scores ?? null,
    })
    .select("*")
    .single<DiagnosisRow>();

  if (error) {
    throw new Error(`Diagnosis insert failed: ${error.message}`);
  }

  return toDiagnosis(data);
}

export async function selectDiagnoses() {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<DiagnosisRow[]>();

  if (error) {
    throw new Error(`Diagnosis list failed: ${error.message}`);
  }

  return data.map(toDiagnosis);
}

export async function selectDiagnosis(id: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase.from("diagnoses").select("*").eq("id", id).maybeSingle<DiagnosisRow>();

  if (error) {
    throw new Error(`Diagnosis fetch failed: ${error.message}`);
  }

  return data ? toDiagnosis(data) : null;
}
