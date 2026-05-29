"use client";

import type { UserStyleProfile } from "@/lib/user-profile-types";

interface ProfileSummaryProps {
  profile: UserStyleProfile | null;
}

function joinOrEmpty(values: string[] | undefined, other?: string) {
  const items = [...(values ?? []), ...(other?.trim() ? [other.trim()] : [])].filter(Boolean);
  return items.length ? items.join("、") : "未填写";
}

function valueOrEmpty(value: string | undefined, other?: string) {
  if (value === "其他" && other?.trim()) {
    return other.trim();
  }
  return value?.trim() ? value : "未填写";
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  if (!profile) {
    return (
      <section className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-slate-600">
        <h2 className="text-lg font-bold text-slate-950">个人肖像档案</h2>
        <p className="mt-3 leading-7">完成个人形象问卷后，这里会集中展示你的基础信息、形象特征和风格偏好。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">个人肖像档案</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <SummaryItem label="性别" value={valueOrEmpty(profile.requiredInfo.gender, profile.requiredInfo.genderOther)} />
        <SummaryItem label="年龄段" value={valueOrEmpty(profile.requiredInfo.ageRange)} />
        <SummaryItem label="职业 / 日常场景" value={valueOrEmpty(profile.requiredInfo.dailyScene, profile.requiredInfo.dailySceneOther)} />
        <SummaryItem label="肤色 / 瞳色 / 发色" value={`${valueOrEmpty(profile.optionalInfo.skinTone)} / ${valueOrEmpty(profile.optionalInfo.eyeColor)} / ${valueOrEmpty(profile.optionalInfo.hairColor)}`} />
        <SummaryItem label="脸型轮廓" value={joinOrEmpty(profile.externalFeatures?.faceContour)} />
        <SummaryItem label="五官细节" value={joinOrEmpty(profile.externalFeatures?.facialDetails)} />
        <SummaryItem label="皮肤与毛发" value={joinOrEmpty(profile.externalFeatures?.skinHairContrast)} />
        <SummaryItem label="风格倾向" value={joinOrEmpty(profile.styleTendency?.values, profile.styleTendency?.other)} />
        <SummaryItem label="穿搭偏好" value={joinOrEmpty(profile.optionalInfo.stylePreferences, profile.optionalInfo.stylePreferenceOther)} />
        <SummaryItem label="妆容偏好" value={joinOrEmpty(profile.optionalInfo.makeupPreferences, profile.optionalInfo.makeupPreferenceOther)} />
      </div>
      {profile.promptContext?.summaryText && (
        <p className="mt-5 whitespace-pre-line rounded-xl bg-indigo-50 p-4 text-sm leading-7 text-indigo-900">
          {profile.promptContext.summaryText}
        </p>
      )}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}
