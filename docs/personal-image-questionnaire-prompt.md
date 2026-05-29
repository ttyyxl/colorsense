# Personal Image Questionnaire Prompt Contract

This document describes the reserved prompt fields for generating a personalized style profile from questionnaire data and a seasonal color diagnosis.

## Firestore Source

Questionnaire document:

```text
users/{uid}/profile/questionnaire
```

Expected shape:

```json
{
  "requiredInfo": {
    "gender": "女性",
    "genderOther": "",
    "ageRange": "25-34",
    "dailyScene": "职场通勤",
    "dailySceneOther": ""
  },
  "optionalInfo": {
    "skinTone": "不确定",
    "eyeColor": "深棕",
    "hairColor": "黑色",
    "stylePreferences": ["简约", "韩系", "通勤"],
    "stylePreferenceOther": "",
    "makeupPreferences": ["裸妆", "通勤妆"],
    "makeupPreferenceOther": ""
  },
  "externalFeatures": {
    "faceContour": ["下颌线圆润", "脸颊饱满（肉感）"],
    "facialDetails": ["眼睛偏圆", "嘴唇厚"],
    "skinHairContrast": ["皮肤对比度低（肤色与发色/瞳色相近）"]
  },
  "styleTendency": {
    "values": ["气质偏年轻"],
    "other": ""
  },
  "aiPromptReady": true,
  "promptContext": {
    "summaryText": "性别：女性\n年龄段：25-34\n职业 / 日常场景：职场通勤",
    "tags": ["下颌线圆润", "眼睛偏圆", "气质偏年轻", "简约", "韩系", "通勤", "裸妆"],
    "promptFields": {
      "gender": "女性",
      "ageRange": "25-34",
      "dailyScene": "职场通勤",
      "skinTone": "不确定",
      "eyeColor": "深棕",
      "hairColor": "黑色",
      "faceContour": ["下颌线圆润", "脸颊饱满（肉感）"],
      "facialDetails": ["眼睛偏圆", "嘴唇厚"],
      "skinHairContrast": ["皮肤对比度低（肤色与发色/瞳色相近）"],
      "styleTendency": ["气质偏年轻"],
      "stylePreferences": ["简约", "韩系", "通勤"],
      "makeupPreferences": ["裸妆", "通勤妆"]
    }
  }
}
```

Latest diagnosis source:

```text
diagnoses/{diagnosisId}
```

Current compatibility fields:

```json
{
  "seasonType": "Soft Summer",
  "confidence": 0.86,
  "createdAt": "serverTimestamp"
}
```

## Prompt Template

```text
你是一名个人色彩与形象风格顾问。

请根据用户的季型诊断结果和个人形象问卷信息，生成个性化造型 / 风格档案。

【必填信息】
性别：{{gender}}
年龄段：{{ageRange}}
职业 / 日常场景：{{dailyScene}}

【季型诊断结果】
季型：{{seasonalType}}
置信度：{{confidence}}

【选填信息】
肤色：{{skinTone}}
瞳色：{{eyeColor}}
发色：{{hairColor}}
脸型轮廓：{{faceContour}}
五官细节：{{facialDetails}}
皮肤与毛发：{{skinHairContrast}}
风格倾向：{{styleTendency}}
穿搭偏好：{{stylePreferences}}
妆容偏好：{{makeupPreferences}}

【输出要求】
1. 用户整体风格画像
2. 推荐颜色方向
3. 避雷颜色
4. 日常和场景穿搭建议
5. 妆容建议
6. 发色和配饰建议
7. 风格误区提醒

如果选填信息为空或“不确定”，请结合季型结果给出温和建议，不要编造用户没有提供的事实。
```

## API Payload Draft

```json
{
  "seasonalType": "Soft Summer",
  "confidence": 0.86,
  "questionnaire": {
    "requiredInfo": {
      "gender": "女性",
      "ageRange": "25-34",
      "dailyScene": "职场通勤"
    },
    "optionalInfo": {
      "skinTone": "不确定",
      "eyeColor": "深棕",
      "hairColor": "黑色",
      "stylePreferences": ["简约", "韩系", "通勤"],
      "makeupPreferences": ["裸妆", "通勤妆"]
    },
    "externalFeatures": {
      "faceContour": ["下颌线圆润", "脸颊饱满（肉感）"],
      "facialDetails": ["眼睛偏圆", "嘴唇厚"],
      "skinHairContrast": ["皮肤对比度低（肤色与发色/瞳色相近）"]
    },
    "styleTendency": {
      "values": ["气质偏年轻"],
      "other": ""
    }
  }
}
```
