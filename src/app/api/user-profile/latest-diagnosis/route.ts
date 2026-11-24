import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function toIsoString(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate?: () => Date };
    return timestamp.toDate?.().toISOString() ?? null;
  }
  return typeof value === "string" ? value : null;
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const db = getAdminDb();
  const snapshot = await db.collection("diagnoses").where("userId", "==", user.uid).get();
  const diagnoses = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const fusion = data.fusionDiagnosis as Record<string, unknown> | undefined;
      // 历史记录没有 v2 状态字段：按 CONFIDENT 处理以保持用户已有画像可访问，
      // 但这些记录未经第三阶段的图像质量与不确定性判断，不代表已通过新版规则校验。
      const status = typeof fusion?.diagnosisStatus === "string" ? fusion.diagnosisStatus : "CONFIDENT";
      return {
        id: doc.id,
        seasonType: data.seasonType ?? null,
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        source: data.source ?? null,
        diagnosisStatus: status,
        createdAt: toIsoString(data.createdAt),
      };
    })
    // 画像与穿搭推荐只采用正式诊断结果；UNCERTAIN/DEGRADED/RETAKE/FAILED 不覆盖已有画像。
    .filter((item) => item.diagnosisStatus === "CONFIDENT")
    .sort((left, right) => getTime(right.createdAt) - getTime(left.createdAt));

  return NextResponse.json({
    success: true,
    diagnosis: diagnoses[0] ?? null,
  });
}

function getTime(value: string | null) {
  if (!value) {
    return 0;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
