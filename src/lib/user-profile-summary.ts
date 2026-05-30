import type { UserStyleProfileInput, UserStyleProfilePromptContext } from "./user-profile-types";

const EMPTY_TEXT = "未填写";

function cleanValue(value: string | undefined) {
  return value?.trim() || EMPTY_TEXT;
}

function cleanList(values: string[] | undefined, other?: string) {
  const base = (values ?? []).map((value) => value.trim()).filter(Boolean);
  const otherValue = other?.trim();
  return otherValue ? [...base, otherValue] : base;
}

function listOrFallback(values: string[]) {
  return values.length ? values : [EMPTY_TEXT];
}

export function buildUserProfilePromptContext(profile: UserStyleProfileInput): UserStyleProfilePromptContext {
  const faceContour = cleanList(profile.externalFeatures.faceContour);
  const facialDetails = cleanList(profile.externalFeatures.facialDetails);
  const skinHairContrast = cleanList(profile.externalFeatures.skinHairContrast);
  const styleTendency = cleanList(profile.styleTendency.values, profile.styleTendency.other);
  const stylePreferences = cleanList(
    profile.optionalInfo.stylePreferences,
    profile.optionalInfo.stylePreferenceOther,
  );
  const makeupPreferences = cleanList(
    profile.optionalInfo.makeupPreferences,
    profile.optionalInfo.makeupPreferenceOther,
  );
  const favoriteColors = cleanList(
    profile.optionalInfo.favoriteColors,
  );
  const gender = profile.requiredInfo.gender === "其他"
    ? cleanValue(profile.requiredInfo.genderOther)
    : cleanValue(profile.requiredInfo.gender);
  const dailyScene = profile.requiredInfo.dailyScene === "其他"
    ? cleanValue(profile.requiredInfo.dailySceneOther)
    : cleanValue(profile.requiredInfo.dailyScene);

  const promptFields = {
    gender,
    ageRange: cleanValue(profile.requiredInfo.ageRange),
    dailyScene,
    skinTone: cleanValue(profile.optionalInfo.skinTone),
    eyeColor: cleanValue(profile.optionalInfo.eyeColor),
    hairColor: cleanValue(profile.optionalInfo.hairColor),
    faceContour: listOrFallback(faceContour),
    facialDetails: listOrFallback(facialDetails),
    skinHairContrast: listOrFallback(skinHairContrast),
    styleTendency: listOrFallback(styleTendency),
    stylePreferences: listOrFallback(stylePreferences),
    makeupPreferences: listOrFallback(makeupPreferences),
    favoriteColors: listOrFallback(favoriteColors),
  };

  const summaryText = [
    `性别：${promptFields.gender}`,
    `年龄段：${promptFields.ageRange}`,
    `职业 / 日常场景：${promptFields.dailyScene}`,
    `肤色：${promptFields.skinTone}`,
    `瞳色：${promptFields.eyeColor}`,
    `发色：${promptFields.hairColor}`,
    `脸型轮廓：${promptFields.faceContour.join("、")}`,
    `五官细节：${promptFields.facialDetails.join("、")}`,
    `皮肤与毛发：${promptFields.skinHairContrast.join("、")}`,
    `风格倾向：${promptFields.styleTendency.join("、")}`,
    `穿搭偏好：${promptFields.stylePreferences.join("、")}`,
    `妆容偏好：${promptFields.makeupPreferences.join("、")}`,
    `喜好颜色：${promptFields.favoriteColors.join("、")}`,
  ].join("\n");

  return {
    summaryText,
    tags: [
      ...faceContour,
      ...facialDetails,
      ...skinHairContrast,
      ...styleTendency,
      ...stylePreferences,
      ...makeupPreferences,
      ...favoriteColors,
      promptFields.gender,
      promptFields.ageRange,
      promptFields.dailyScene,
    ].filter((value) => value !== EMPTY_TEXT),
    promptFields,
  };
}
