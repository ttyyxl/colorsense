"use client";

import type { UserStyleProfile } from "@/lib/user-profile-types";

const COMMON_COLORS = [
  { name: "黑色", shades: ["black"] },
  { name: "白色", shades: ["white"] },
  { name: "灰色", shades: ["bg-gray-100", "bg-gray-300", "bg-gray-500", "bg-gray-700", "bg-gray-900"] },
  { name: "米白", shades: ["bg-stone-100", "bg-stone-200", "bg-stone-300", "bg-stone-400"] },
  { name: "奶咖", shades: ["bg-amber-100", "bg-amber-200", "bg-amber-300", "bg-amber-400"] },
  { name: "棕色", shades: ["bg-amber-500", "bg-amber-700", "bg-amber-900"] },
  { name: "红色", shades: ["bg-red-100", "bg-red-300", "bg-red-500", "bg-red-700", "bg-red-900"] },
  { name: "酒红", shades: ["bg-red-600", "bg-red-800", "bg-red-900"] },
  { name: "橙色", shades: ["bg-orange-100", "bg-orange-300", "bg-orange-500", "bg-orange-700", "bg-orange-900"] },
  { name: "黄色", shades: ["bg-yellow-100", "bg-yellow-300", "bg-yellow-400", "bg-yellow-500", "bg-yellow-700"] },
  { name: "牛油果绿", shades: ["bg-lime-300", "bg-lime-500", "bg-lime-700"] },
  { name: "绿色", shades: ["bg-green-100", "bg-green-300", "bg-green-500", "bg-green-700", "bg-green-900"] },
  { name: "墨绿", shades: ["bg-green-600", "bg-green-800", "bg-green-900"] },
  { name: "蓝色", shades: ["bg-blue-100", "bg-blue-300", "bg-blue-500", "bg-blue-700", "bg-blue-900"] },
  { name: "深蓝", shades: ["bg-blue-600", "bg-blue-800", "bg-blue-900"] },
  { name: "紫色", shades: ["bg-purple-100", "bg-purple-300", "bg-purple-500", "bg-purple-700", "bg-purple-900"] },
  { name: "粉色", shades: ["bg-pink-100", "bg-pink-300", "bg-pink-400", "bg-pink-500", "bg-pink-700"] },
  { name: "裸粉", shades: ["bg-rose-100", "bg-rose-200", "bg-rose-300", "bg-rose-400"] },
  { name: "银色", shades: ["bg-slate-100", "bg-slate-300", "bg-slate-500"] },
  { name: "金色", shades: ["bg-amber-100", "bg-amber-300", "bg-amber-500"] },
];

const getDisplayColorName = (value: string) => {
  if (value === "black") return "黑色";
  if (value === "white") return "白色";

  for (const group of COMMON_COLORS) {
    if (group.shades.includes(value)) {
      return group.name;
    }
  }
  return value;
};

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
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 col-span-full">
          <p className="text-xs font-semibold uppercase text-slate-500">喜好颜色</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.optionalInfo.favoriteColors?.map((colorValue) => (
              <div
                key={colorValue}
                className={`w-8 h-8 rounded-full
                  ${colorValue === "white" || colorValue === "black" ? "border border-slate-300" : ""}`}
                style={{ backgroundColor: colorValue.startsWith("bg-") ? undefined : colorValue }}
                title={getDisplayColorName(colorValue)}
              >
                {colorValue.startsWith("bg-") && colorValue !== "black" && colorValue !== "white" && (
                  <div className={`${colorValue} w-full h-full rounded-full`}></div>
                )}
              </div>
            ))}
            {profile.optionalInfo.favoriteColors?.length === 0 && (
              <p className="text-sm font-medium leading-6 text-slate-800">未填写</p>
            )}
          </div>
        </div>
      </div>

      {profile.generatedProfileAdvice && (
        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-bold text-slate-950">AI 形象顾问建议</h3>

          {profile.generatedProfileAdvice.title && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-800">标题: {profile.generatedProfileAdvice.title}</p>
            </div>
          )}

          {profile.generatedProfileAdvice.summary && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">总结: {profile.generatedProfileAdvice.summary}</p>
            </div>
          )}

          {profile.generatedProfileAdvice.personality_traits && profile.generatedProfileAdvice.personality_traits.length > 0 && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">性格特征: {profile.generatedProfileAdvice.personality_traits.join("、")}</p>
            </div>
          )}

          {profile.generatedProfileAdvice.style_essence && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">风格精髓: {profile.generatedProfileAdvice.style_essence}</p>
            </div>
          )}

          {profile.generatedProfileAdvice.wardrobe_suggestions && profile.generatedProfileAdvice.wardrobe_suggestions.length > 0 && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">穿搭建议:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-indigo-800">
                {profile.generatedProfileAdvice.wardrobe_suggestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.generatedProfileAdvice.color_palette_advice && profile.generatedProfileAdvice.color_palette_advice.length > 0 && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">色彩搭配建议:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-indigo-800">
                {profile.generatedProfileAdvice.color_palette_advice.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.generatedProfileAdvice.makeup_hair_suggestions && profile.generatedProfileAdvice.makeup_hair_suggestions.length > 0 && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">妆容发型建议:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-indigo-800">
                {profile.generatedProfileAdvice.makeup_hair_suggestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.generatedProfileAdvice.accessories_guidance && profile.generatedProfileAdvice.accessories_guidance.length > 0 && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">配饰指导:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-indigo-800">
                {profile.generatedProfileAdvice.accessories_guidance.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.generatedProfileAdvice.overall_impression && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">整体印象: {profile.generatedProfileAdvice.overall_impression}</p>
            </div>
          )}
        </div>
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
