import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isExecutableDiagnosisStatus, resolveDiagnosisStatusOf } from "@/lib/diagnosis-status";

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
      // 历史记录没有 v2 状态字段：按 CONFIDENT 处理以保持用户已有画像可访问，
      // 但这些记录未经第三阶段的图像质量与不确定性判断，不代表已通过新版规则校验。
      const status = resolveDiagnosisStatusOf({
        diagnosisStatus: data.diagnosisStatus,
        fusionDiagnosis: data.fusionDiagnosis,
      });
      return {
        id: doc.id,
        seasonType: data.seasonType ?? null,
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        source: data.source ?? null,
        diagnosisStatus: status,
        createdAt: toIsoString(data.createdAt),
      };
    })
    // Phase 3.3：画像与穿搭推荐采用「存在有效季型结果」的全部诊断。
    // 只有硬阻断状态（RETAKE_REQUIRED / FAILED）不参与；
    // UNCERTAIN / DEGRADED 同样可用于画像，并携带状态供前端提示不确定性。
    .filter((item) => isExecutableDiagnosisStatus(item.diagnosisStatus))
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
