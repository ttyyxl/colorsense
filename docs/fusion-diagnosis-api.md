# 综合诊断接口契约（fusionDiagnosis v1.0）

> 供用户画像、四季色环、穿搭推荐、数字衣橱、诊断报告等模块共用。
> **本文所有 JSON 示例均为虚构的 Schema 示例，仅用于说明字段结构，不是任何真实模型实验结果，也不代表融合准确率。**

## 1. 接口概览

| 项目 | 说明 |
| --- | --- |
| 接口路径 | `POST /api/diagnose` |
| 请求方式 | `multipart/form-data` |
| 鉴权 | Firebase ID Token，经服务端 `verifyAuth()` 校验；邮箱用户须完成邮箱验证，Google 用户可直接使用 |
| 请求字段 | `image`：JPG / PNG / WebP / HEIC / HEIF，≤ 10MB，正面人像 |
| 返回 | `{ success, diagnosisId, data }`，`data` 中同时包含兼容字段与可选的 `fusionDiagnosis` |
| 综合结果读取 | `data.fusionDiagnosis`（本次响应）；历史记录从 Firestore `diagnoses/{diagnosisId}.fusionDiagnosis` 读取 |
| 权重 | 固定 CNN 40% / Doubao 60%；只能由服务端环境变量设置，客户端无法覆盖 |
| 默认状态 | `FUSION_ENABLED=false`，接口行为与第一阶段完全一致，不返回 `fusionDiagnosis`，不调用付费 API |

## 2. 服务端开关

```env
FUSION_ENABLED=false          # 是否启用融合
FUSION_CNN_WEIGHT=0.4         # CNN 权重；Doubao 权重 = 1 - 该值，默认 0.6
VISION_DIAGNOSIS_ENABLED=false # Doubao 视觉模块总开关
ARK_API_KEY=...               # 服务端密钥，禁止提交
ARK_VISION_MODEL=...
```

- 两个开关必须**同时为 true** 才会发起 Doubao 付费调用。仅 `FUSION_ENABLED=true` 时会安全降级为纯 CNN，并给出 `fallbackReason = "DOUBAO_MASTER_DISABLED"`。
- 启用融合时会检查 `ARK_API_KEY` / `ARK_VISION_MODEL` 是否配置；缺失时降级为纯 CNN。
- `FUSION_CNN_WEIGHT` 非法（非数字、超出 `[0,1]`）时返回 500 `FUSION_CONFIG_INVALID`，**不会**静默使用错误权重。
- `FUSION_ENABLED=false` 时不校验权重，也不触发任何 Doubao 视觉调用。

### 2.1 脱敏诊断日志（默认关闭）

```env
VISION_DIAGNOSTICS_LOG_ENABLED=false
```

设为 `true` 并重启服务端后，会输出前缀为 `[vision-diagnostics]` 的日志，仅包含白名单字段：
图片 MIME、输入/输出尺寸与字节数、JPEG EXIF Orientation 及应用状态、模型 ID、耗时、finishReason、
requestId、token usage、`canJudgeReliably` / `lightingWarning` / `filterWarning`，以及融合 `source` / `fallbackReason`。
不会记录 API Key、Base64、Prompt、人脸照片、自然语言 `reason` 或用户画像；日志不写入 Firestore。

## 3. 返回字段定义

### 3.1 顶层兼容字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | 是否成功 |
| `diagnosisId` | string | Firestore 文档 ID |
| `data.seasonType` | `"spring"\|"summer"\|"autumn"\|"winter"` | 最终季型。开启融合时**等于** `fusionDiagnosis.predictedSeason` |
| `data.confidence` | number | 旧字段。开启融合时 = `fusionDiagnosis.seasonScores[predictedSeason]`，即 top-1 融合分数。**不是**经过概率校准的置信度；未开启融合时保持原 CNN 置信度 |
| `data.scores` | object | 旧字段。开启融合时 = `fusionDiagnosis.seasonScores`（融合后四季得分）；未开启融合时为原 CNN scores |
| `data.source` | `"model"` | 兼容字段，表示诊断已通过 CNN 人脸质量校验，不代表最终模型来源；模型来源请看 `fusionDiagnosis.source` |
| `data.colorPalette` / `styleKeywords` / `avoidColors` / `aiDescription` / `labFeatures` / `faceDetected` / `usedOriginalImage` / `faceConfidence` / `doubaoAdvice` | — | 第一阶段已有字段，含义不变 |
| `data.fusionDiagnosis` | object \| 缺失 | 新增综合结果；仅 `FUSION_ENABLED=true` 时存在 |

### 3.2 `fusionDiagnosis`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `version` | `"1.0"` | Schema 版本 |
| `predictedSeason` | 四季枚举 | **最终季型，供所有下游模块统一读取** |
| `seasonScores` | `SeasonScores` | 四季融合得分，四项之和为 1；归一化后的加权结果，**非校准概率** |
| `source` | `"fusion"\|"cnn"\|"doubao"` | 结果来源：融合 / 纯 CNN 降级 / 纯 Doubao 降级 |
| `requestedWeights` | `{cnn,doubao}` | 请求使用的配置权重（如 0.4 / 0.6） |
| `effectiveWeights` | `{cnn,doubao}` | 实际生效权重；降级时为 1/0 或 0/1 |
| `cnn.available` | boolean | CNN 是否提供了合法四季分数 |
| `cnn.predictedSeason` | 四季枚举（可选） | CNN top-1 |
| `cnn.seasonScores` | `SeasonScores`（可选） | 推理服务返回的**原始** softmax 分数，未重新校准 |
| `doubao.available` | boolean | Doubao 结果是否可用 |
| `doubao.predictedSeason` | 四季枚举（可选） | Doubao top-1 |
| `doubao.seasonScores` | `SeasonScores`（可选） | Doubao 原始四季相对匹配分数，已由 VisionResult 归一化 |
| `doubao.canJudgeReliably` | boolean（可选） | Doubao 可靠性判断；`false` 即拒判 |
| `doubao.features` | object（可选） | 四个视觉特征；**拒判或失败时不提供** |
| `doubao.features.skin_undertone` | `"warm"\|"cool"\|"neutral"\|"unknown"` | 与 `VisionResult.skin_undertone` 同名同枚举 |
| `doubao.features.brightness` | `"light"\|"medium"\|"dark"\|"unknown"` | 同上 |
| `doubao.features.saturation` | `"soft"\|"moderate"\|"vivid"\|"unknown"` | 同上；第一阶段无 `clarity` 字段，不要自行假设 |
| `doubao.features.feature_contrast` | `"low"\|"medium"\|"high"\|"unknown"` | 同上 |
| `doubao.lightingWarning` | boolean（可选） | 光照风险提示 |
| `doubao.filterWarning` | boolean（可选） | 滤镜风险提示 |
| `doubao.reason` | string（可选） | Doubao 给出的简短理由（受 Schema 长度限制，非原始思考内容） |
| `fallbackReason` | string \| `null` | 机器可读降级代码；融合成功时为 `null` |
| `fallbackDetails` | `{cnn,doubao}` | 两个模型各自的代码，便于排障 |
| `meta.doubaoModelId` | string（可选） | 来自 `VisionCallMeta.modelId` |
| `meta.doubaoDurationMs` | number（可选） | 来自 `VisionCallMeta.durationMs` |
| `meta.doubaoUsage` | object（可选） | 来自 `VisionCallMeta.usage`，仅 token 计数 |

**降级代码**：`DOUBAO_MASTER_DISABLED`、`DOUBAO_CONFIG_MISSING`、`DOUBAO_FEATURE_DISABLED`、`DOUBAO_UNSUPPORTED_IMAGE_TYPE`、`DOUBAO_IMAGE_TOO_LARGE`、`DOUBAO_INVALID_IMAGE_DATA`、`DOUBAO_IMAGE_DIMENSIONS_TOO_LARGE`、`DOUBAO_AUTH_FAILED`、`DOUBAO_RATE_LIMITED`、`DOUBAO_TIMEOUT`、`DOUBAO_API_ERROR`、`DOUBAO_INVALID_RESPONSE`、`DOUBAO_UNRELIABLE`、`DOUBAO_INVALID_SCORES`、`CNN_INVALID_SCORES`、`CNN_MISSING`、`CNN_UNSUPPORTED_SEASON`。

**并列规则**：四季分数容差 `1e-9` 内并列时，按 `spring → summer → autumn → winter` 顺序取靠前者，结果确定可复现。

## 4. 正常融合示例（Schema 示例 · 虚构数据）

```json
{
  "success": true,
  "diagnosisId": "example-doc-id",
  "data": {
    "seasonType": "summer",
    "confidence": 0.50,
    "scores": { "spring": 0.20, "summer": 0.50, "autumn": 0.10, "winter": 0.20 },
    "source": "model",
    "fusionDiagnosis": {
      "version": "1.0",
      "predictedSeason": "summer",
      "seasonScores": { "spring": 0.20, "summer": 0.50, "autumn": 0.10, "winter": 0.20 },
      "source": "fusion",
      "requestedWeights": { "cnn": 0.4, "doubao": 0.6 },
      "effectiveWeights": { "cnn": 0.4, "doubao": 0.6 },
      "cnn": {
        "available": true,
        "predictedSeason": "spring",
        "seasonScores": { "spring": 0.40, "summer": 0.30, "autumn": 0.15, "winter": 0.15 }
      },
      "doubao": {
        "available": true,
        "predictedSeason": "summer",
        "seasonScores": { "spring": 0.067, "summer": 0.633, "autumn": 0.067, "winter": 0.233 },
        "canJudgeReliably": true,
        "features": {
          "skin_undertone": "cool",
          "brightness": "light",
          "saturation": "soft",
          "feature_contrast": "low"
        },
        "lightingWarning": false,
        "filterWarning": false,
        "reason": "虚构示例：肤色偏冷、对比柔和，据此倾向夏季型。"
      },
      "fallbackReason": null,
      "fallbackDetails": { "cnn": "OK", "doubao": "OK" },
      "meta": { "doubaoModelId": "example-model", "doubaoDurationMs": 1234 }
    }
  }
}
```

计算核对（虚构）：`spring = 0.4×0.40 + 0.6×0.067 ≈ 0.20`，`summer = 0.4×0.30 + 0.6×0.633 ≈ 0.50`，最终季型取最高分 `summer`，与 CNN top-1 不同属于正常情况。

## 5. CNN 降级示例（Schema 示例 · 虚构数据）

Doubao 请求失败 / 超时 / 429 / Schema 校验失败 / `can_judge_reliably=false` / 四季分数非法时，只要 CNN 分数合法即回退纯 CNN：

```json
{
  "source": "cnn",
  "seasonScores": { "spring": 0.55, "summer": 0.20, "autumn": 0.15, "winter": 0.10 },
  "predictedSeason": "spring",
  "requestedWeights": { "cnn": 0.4, "doubao": 0.6 },
  "effectiveWeights": { "cnn": 1, "doubao": 0 },
  "doubao": { "available": false, "canJudgeReliably": false, "lightingWarning": true, "filterWarning": false },
  "fallbackReason": "DOUBAO_UNRELIABLE",
  "fallbackDetails": { "cnn": "OK", "doubao": "DOUBAO_UNRELIABLE" }
}
```

拒判时 `doubao.features` 必须缺失，不得生成虚假特征。

## 6. Doubao 降级示例（Schema 示例 · 虚构数据）

仅当 CNN 推理与人脸质量校验已通过、但 CNN 四季分数非法时使用；此时仍具备可信的人脸质量信息，不会绕过原有安全门控：

```json
{
  "source": "doubao",
  "seasonScores": { "spring": 0.10, "summer": 0.60, "autumn": 0.20, "winter": 0.10 },
  "predictedSeason": "summer",
  "requestedWeights": { "cnn": 0.4, "doubao": 0.6 },
  "effectiveWeights": { "cnn": 0, "doubao": 1 },
  "cnn": { "available": false },
  "doubao": {
    "available": true,
    "predictedSeason": "summer",
    "seasonScores": { "spring": 0.10, "summer": 0.60, "autumn": 0.20, "winter": 0.10 },
    "canJudgeReliably": true,
    "features": {
      "skin_undertone": "cool",
      "brightness": "medium",
      "saturation": "moderate",
      "feature_contrast": "medium"
    }
  },
  "fallbackReason": "CNN_INVALID_SCORES"
}
```

**注意**：如果 CNN 推理本身失败（未检测到清晰人脸、模型服务不可用），仍按第一阶段原逻辑返回 `422 NO_CLEAR_FACE` 或 `503 MODEL_UNAVAILABLE`，不会因为 Doubao 成功而生成诊断结果。

## 7. 失败响应格式

```json
{ "success": false, "error": "DIAGNOSIS_FAILED", "code": "ALL_MODELS_UNAVAILABLE",
  "message": "两个模型均无法给出有效的四季评分，请上传光线更合适的正面照片后重试。",
  "fallbackDetails": { "cnn": "CNN_INVALID_SCORES", "doubao": "DOUBAO_TIMEOUT" } }
```

其他既有错误保持不变：`401` 未登录、`403` 邮箱未验证、`400` 图片格式/大小错误、`422 NO_CLEAR_FACE`、`503 MODEL_UNAVAILABLE`、`504` 超时、`500 FUSION_CONFIG_INVALID`（权重配置非法）。错误响应不包含 API Key、完整 Prompt、原始模型响应或敏感日志。

## 8. 向后兼容

- 旧字段 `seasonType`、`confidence`、`scores`、`source` 全部保留，结果页无需修改。
- 开启融合时 `seasonType` 与 `fusionDiagnosis.predictedSeason` **始终一致**；顶层不存在与之矛盾的 `season` 字段。
- `confidence` 在融合开启时表示 top-1 融合分数（非校准概率）；下游若需要展示「置信度」，建议使用 `seasonScores[predictedSeason]` 并标注为相对得分。
- `seasons` / `seasonType` 枚举与第一阶段相同；未开启融合时 `fusionDiagnosis` 字段完全不存在。
- Firestore 老记录没有 `fusionDiagnosis` 时，`getUserDiagnosis()` 正常返回，结果页照常显示。

## 9. 前端 / 组员集成指导

**数据读取优先级**（推荐 TypeScript 伪代码）：

```ts
const fusion = diagnosis.fusionDiagnosis;

// 1) 最终季型：统一读这里；老记录回退到 seasonType
const season = fusion?.predictedSeason ?? diagnosis.seasonType;

// 2) 四季得分：统一读这里；老记录回退到 scores
const scores = fusion?.seasonScores ?? diagnosis.scores;

// 3) 视觉特征：仅 Doubao 可用时存在，不存在就显示「暂无视觉特征」
const features = fusion?.doubao.available ? fusion.doubao.features : undefined;

// 4) 来源与不确定性
const source = fusion?.source; // fusion | cnn | doubao
const hints = {
  unreliable: fusion?.doubao.canJudgeReliably === false,
  lighting: fusion?.doubao.lightingWarning === true,
  filter: fusion?.doubao.filterWarning === true,
  fallback: fusion?.fallbackReason ?? null,
};
if (hints.unreliable || hints.lighting || hints.filter) {
  // 提示用户在自然光下重新上传无滤镜的正面照片
}
```

**读取历史记录**：客户端调用 `getUserDiagnosis(id, currentUser.uid)`（Firestore `diagnoses/{id}`），或服务端通过 Admin SDK 查询 `diagnoses` 集合；两种路径都会返回可选的 `fusionDiagnosis` 字段。

**注意事项**：
- 不要读取 `doubao.features` 中不存在的字段；不要创建 `clarity` 等第一阶段没有的字段。
- 不要把 `cnn.seasonScores`（原始 softmax）与 `seasonScores`（融合结果）混用。
- 不要把融合分数描述为「准确率」或「经过校准的概率」。
- 用户画像、色环、穿搭推荐等模块只需依赖 `predictedSeason`、`seasonScores` 和可选的 `doubao.features`，无需关心使用的是融合还是降级结果。
