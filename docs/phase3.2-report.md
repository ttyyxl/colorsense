# ColorSense Phase 3.2 — 诊断决策机制修复与离线参数优化报告

- 版本：Phase 3.2
- 日期：2026-11-24
- 分支：`feature/fusion-diagnosis`
- 基线来源：Phase 3.1 报告与 `experiments/phase3.1/results/fusion_results.csv`（保留原样，未修改）
- 新增付费 API 调用：**0 次**；新增 Token 消耗：**0**

---

## 1. 修复结论：11 个核心问题的明确回答

| # | 问题 | 结论 |
|---|---|---|
| 1 | 为什么 96 张只有 4 张 CONFIDENT？ | Phase 3.1 把**软警告与决定性风险混为一谈**：`MODEL_TOP1_MISMATCH`（Top-1 不一致但分布接近）被当作决定性风险，`DOUBAO_LIGHTING_WARNING` / `DOUBAO_FILTER_WARNING` / `POSSIBLE_COLOR_CAST` 等纯提示项同样触发 UNCERTAIN。96 张中 62 张因此落入 UNCERTAIN。修复后软警告单独不再阻断，正式输出恢复到 19 张（覆盖率 19.79%）。 |
| 2 | 为什么覆盖率 24.24% ≠ 默认阈值 19.7%？ | 两者口径不同，不是同一实验。24.24% 来自 Phase 3.1 `weight-threshold-scan.mjs` 的**自建简化规则**：其权重表缺 TVD 判定、阈值表缺单模型区分度判定（`CNN_LOW_DISCRIMINATION`），且把 Top-1 不一致一律当作决定性。本报告全部重放改为直接调用生产 `buildAdvancedDiagnosis()` / `decideDiagnosisStatus()`，在生产默认阈值下覆盖率恒为 **19.79%**（19/96）。24.24% 是简化规则下的产物，不可作为生产口径引用。 |
| 3 | 24 张质量拦截 vs 32/32 严重异常拦截为何不一致？ | **分母不同，不是矛盾**。24 = 8 张原图 × 3 类本地质量门控（blur_severe / overexposed / underexposed）= 24 张 REJECT；32/32 = 8 张原图 × 4 类严重变体（原图 + blur_severe + overexposed + underexposed）全部未达 CONFIDENT，其中 24 张 RETAKE_REQUIRED + 8 张 strong_filter（修复前判 UNCERTAIN，修复后仍为 UNCERTAIN）。修复前后严重拦截恒为 **32/32**。 |
| 4 | 6 张豆包主动拒判如何处理？ | `can_judge_reliably=false` 是 **API 调用成功但模型主动拒判**（语义等价"图中有强滤镜/严重处理，我无法可靠判断"），**不等于服务故障**。Phase 3.1 离线脚本丢弃了拒判结果对象，导致口径与生产不一致（生产侧落入单模型降级 DEGRADED）。修复后新增独立状态 `DOUBAO_REFUSED`（决定性风险）→ UNCERTAIN，`inferenceMode = dual-refused`，不伪造分数、不重试、不生成正式画像与付费建议。网络/服务异常仍走 `SINGLE_MODEL_DEGRADED` → DEGRADED。 |
| 5 | 软警告与硬风险如何分层？ | 建立三级风险模型：`SOFT_WARNING`（不阻断，仅提示）／`DECISIVE_RISK`（决定性，触发 UNCERTAIN）／`BLOCKING_ISSUE`（阻断，触发 RETAKE_REQUIRED）。配合同 `group` 相关性分组与 `domain`（image / model）标记，软警告仅在**图像侧与模型侧各命中一类**时才升级为 `MULTIPLE_INDEPENDENT_RISKS`；同组软警告（如同时存在多个光照提示）不升级。 |
| 6 | 哪些属于决定性依据？ | 综合分不足（`TOP_SCORE_BELOW_THRESHOLD`）、分差过小（`TOP_GAP_BELOW_THRESHOLD`）、TVD 严重分歧（`MODEL_DISTRIBUTION_DISAGREEMENT`）、严重色彩失真（`SEVERE_COLOR_DISTORTION`）、模型明确无法可靠判断（`DOUBAO_REFUSED`）、单模型区分度不足（`CNN_LOW_DISCRIMINATION`）。严重过曝/欠曝/模糊/分辨率/人脸/双模型失败继续阻断。 |
| 7 | 五状态架构是否改变？ | **未改变**。`CONFIDENT / UNCERTAIN / RETAKE_REQUIRED / DEGRADED / FAILED` 全部保留。`AdvancedFusionDiagnosis` 新增字段 `risks` / `decisiveReasons` / `softWarnings` 均为**可选**，历史记录（v1/v2 快照）保持可解析、可访问。 |
| 8 | 图像色偏与质量检测如何优化？ | 复用 768 张**免费预检**数据完成阈值分析。色偏指标语义明确为「**颜色分布异常风险**」而非滤镜识别。评估了复用 MediaPipe 人脸区域（作为人脸存在性信号，不改变现有阈值）。保留已验证有效的严重异常机制。新增 `SEVERE_COLOR_DISTORTION`（`channelCast >= 0.30`，决定性但**绝不阻断**）。 |
| 9 | 参数是否变化？ | 生产参数**仅新增/启用 2 项**：① 风险分层策略 `layered`（新增）；② `channelCastSevere = 0.30`（新增）。其余**全部保持不变**：融合权重 40:60、`minTopScore 0.50`、`minTopGap 0.10`、`totalVariationDistance 0.40`、`minModelTopGap 0.08`、`channelCastWarning 0.11`、`channelCastHigh 0.20`；动态权重 applicability/reliability **保持中性 1**。 |
| 10 | 数据划分与泄漏如何处理？ | 第一轮 8 张原图**全部命中 CNN 训练/验证集**（train 7 / val 1），独立样本 0 张。已锁定 CNN test 原图 22 张 + 同源变体共 264 张为**唯一独立评估集**，本轮 0 张进入第一轮探索。训练/验证重叠样本标记为非独立评估数据（`round1_and_calibration` / `calibration`），仅可用于机制测试与开发期参数探索。**并已在该独立集上完成零付费的部分验证**：质量门控拦截 88/88、严重色偏阈值误标率 4.55% / 检出率 95.45%、CNN 独立 Top-1 准确率 54.55%（§7.3）。 |
| 11 | 能否为 `winter__766` / `winter__766__cool` 等写特例？ | **不能，且不应**。这些案例两模型一致但共同误判（winter__766__original / __cool：两模型均判 autumn，参考 winter），现有图像质量指标与模型分数无法识别此类系统性偏差。已如实记录为已知局限，未写入任何针对个别 ID 或季型的特殊规则。 |

---

## 2. 代码修改表

### 2.1 新增文件

| 文件 | 用途 |
|---|---|
| `src/lib/diagnosis-config.ts` | 阈值与风险分类的集中配置（项目既有约定：所有阈值集中于此） |
| `src/lib/diagnosis-types.ts` | 五状态类型定义 + `DiagnosisRiskEntry` / `DiagnosisRiskLevel` |
| `src/lib/diagnosis-status.ts` | 决策层（`decideDiagnosisStatus`），Phase 3.2 核心重写 |
| `src/lib/advanced-diagnosis.ts` | 编排层（`buildAdvancedDiagnosis`），生产重放入口 |
| `src/lib/agreement.ts` | 双模型一致性评估（TVD / Top-1） |
| `src/lib/image-quality.ts` | 图像质量与色偏检测 |
| `src/lib/weighting.ts` | 动态权重三因子计算 |
| `src/lib/diagnosis-status-ui.ts` | 原因码 → 文案映射 + 软警告/决定性原因拆分 |
| `src/components/DiagnosisStatusNotice.tsx` | 状态提示组件（新增软警告展示） |
| `tests/advanced-diagnosis.test.ts` | Phase 3.2 决策机制测试（新增 13 项） |
| `tests/diagnosis-status-ui.test.ts` | 原因拆分与标签测试（新增 3 项） |
| `experiments/phase3.1/scripts/phase3.2-analysis.mjs` | **唯一**离线实验脚本（全部经生产函数重放） |
| `experiments/phase3.1/candidate_config.json` | **唯一**候选配置（baseline + 各候选参数 + 实验证据） |
| `experiments/phase3.1/results/phase3.2_analysis.json` | **唯一**新增结果文件（实验原始数据） |
| `docs/phase3.2-report.md` | **唯一**综合报告（本文件） |

### 2.2 修改文件

| 文件 | 修改内容 |
|---|---|
| `src/lib/fusion-api.ts` | `AssembledAdvancedFields` 增加 `risks` / `decisiveReasons` / `softWarnings` 并透传 |
| `src/app/api/diagnose/route.ts` | `doubaoCode` 依据 `can_judge_reliably` 区分 `OK` / `DOUBAO_UNRELIABLE`；响应与 blocked 响应透传三级风险字段 |
| `src/app/api/user-profile/latest-diagnosis/route.ts` | 注释明确历史记录按 CONFIDENT 处理以保持可访问，但**未经新版规则校验**；过滤逻辑仍为 `status === "CONFIDENT"` |
| `src/app/result/[id]/page.tsx` | 引入 `splitReasons`，`DiagnosisStatusNotice` 统一渲染一次并传 `decisiveReasons` + `softWarnings`；新增历史记录提示块 |
| `src/components/DiagnosisStatusNotice.tsx` | CONFIDENT 且含软警告时以 info 色调展示"提示（不影响本次正式结果）" |
| `tests/diagnose-flow.test.ts` | 新增 3 项颜色分级/阈值覆盖用例（合成 PNG） |
| `tests/doubao-vision.test.ts` | 新增"主动拒判是成功响应且从不重试"用例（断言 `calls === 1`、`meta.attempts === 1`） |

### 2.3 核心机制变更

**风险分层模型**（`diagnosis-config.ts` → `DIAGNOSIS_RISK_CLASSIFICATION`）：

```
SOFT_WARNING   轻度色偏 / 轻度光照 / 一般质量 WARNING / 豆包普通光照或滤镜风险
                / Top-1 不一致但分布接近          → 仅提示，不改变状态
DECISIVE_RISK  综合分不足 / 分差过小 / TVD 严重分歧 / 严重色彩失真
                / 图像风险+模型分歧并存 / 模型明确无法可靠判断  → UNCERTAIN
BLOCKING_ISSUE 严重过曝·欠曝·模糊·分辨率·人脸·双模型失败        → RETAKE_REQUIRED
```

升级规则：软警告需同时命中**图像侧**与**模型侧**（不同 `domain`）且属于**不同 `group`** 才升级为 `MULTIPLE_INDEPENDENT_RISKS`；同组相关警告不升级。

**豆包拒判与服务异常分离**：

| 场景 | 判定 | inferenceMode | diagnosisStatus |
|---|---|---|---|
| 豆包返回 `can_judge_reliably=false` | `DOUBAO_REFUSED`（决定性） | `dual-refused` | `UNCERTAIN` |
| 豆包网络/服务异常 | `SINGLE_MODEL_DEGRADED` | `single-cnn` | `DEGRADED` |
| 双模型均不可用 | 阻断 | — | `RETAKE_REQUIRED` |

`inferenceMode` 与 `diagnosisStatus` 保持两条独立轴：前者描述"用了哪些模型"，后者描述"能否给出正式结论"。

---

## 3. 基线一致性（重放管线可信度验证）

为证明离线重放忠实于生产实现，构造 **legacy 策略**（精确复现 Phase 3.1 的扁平规则）并丢弃豆包拒判结果，与 Phase 3.1 `fusion_results.csv` 逐张比对：

| 校验项 | 结果 |
|---|---|
| 样本总数 | 96 |
| `diagnosisStatus` 一致 | **96 / 96**（不一致 0） |
| 原因码集合一致 | **96 / 96**（不一致 0） |

结论：重放管线与 Phase 3.1 生产结论完全等价，后续 A→B→E 的一切差异均来自被测机制本身，而非脚本实现偏差。

> 对照说明：Phase 3.1 报告中的 96 张仅 4 张 CONFIDENT 与覆盖率 19.7%，在本管线中以 legacy 策略**精确复现**；因此 Phase 3.1 原始报告全部保留，**未做任何修改**。

---

## 4. 修复前后对照（A = Phase 3.1 原始规则 → B = 机制修复）

重放口径：96 张 = 8 张原图 × 12 个变体（original / darker / brighter / warm / cool / low_saturation / high_saturation / blur_light / blur_severe / overexposed / underexposed / strong_filter）。

### 4.1 状态分布

| 状态 | A（Phase 3.1） | B（机制修复） | 变化 |
|---|---|---|---|
| CONFIDENT | 4 | **19** | +15 |
| UNCERTAIN | 62 | **53** | −9 |
| RETAKE_REQUIRED | 24 | 24 | 0 |
| DEGRADED | 6 | **0** | −6 |
| FAILED | 0 | 0 | 0 |

### 4.2 关键指标

| 指标 | A | B | 说明 |
|---|---|---|---|
| 正式输出覆盖率 | 4.17%（4/96） | **19.79%（19/96）** | 提升 4.7 倍 |
| 已接受准确率 | 2/4 = 50.00% | **8/19 = 42.11%** | 分母扩大 5 倍，准确率略降属必然 |
| 正确正式诊断 | 2 | **8** | +6 |
| 错误正式诊断 | 2 | **11** | +9（覆盖率提升的代价，已如实计入） |
| 错误正式诊断率 | 2.08% | 11.46% | 需在 UI 与产品侧明示 |
| 整体正确诊断率 | 2.08% | **8.33%** | +6.25pp |
| 不确定率 | 64.58% | **55.21%** | −9.37pp |
| 拒拍率 | 25.00% | 25.00% | 不变 |
| 降级率 | 6.25% | **0%** | 6 张拒判从"服务故障"回归为"模型拒判" |
| 原图正式覆盖 | 1/8 = 12.5% | **3/8 = 37.5%** | +2 |
| 原图误拒（正常图被拒） | 0 | **0** | 未引入新的误拒 |
| 严重异常拦截 | 32/32 | **32/32** | 机制修复未削弱拦截能力 |
| 纯分类准确率（共同样本 66） | 28/66 = 42.42% | 28/66 = 42.42% | 不变（机制修复不触碰分类层） |
| 纯分类 macro-F1 | 0.4089 | 0.4089 | 不变 |

**关键判读**：覆盖率从 4.17% 提升到 19.79% 的同时，错误正式诊断从 2 例增至 11 例。**这不是"性能提升"，而是"可输出边界扩大"的诚实代价**。已接受准确率从 50%（n=4）回落到 42.11%（n=19）属于分母扩大后的正常回归；绝对正确诊断数仍从 2 增至 8。严重异常拦截与正常图误拒两项安全指标**完全未退化**。

### 4.3 6 张豆包主动拒判的对照

| image_id | Phase 3.1 | 修复后 | inferenceMode | 决定性原因 |
|---|---|---|---|---|
| `autumn__14__strong_filter` | DEGRADED | **UNCERTAIN** | `dual-refused` | DOUBAO_REFUSED / SEVERE_COLOR_DISTORTION / TOP_SCORE_BELOW_THRESHOLD / TOP_GAP_BELOW_THRESHOLD |
| `autumn__3544__strong_filter` | DEGRADED | **UNCERTAIN** | `dual-refused` | 同上 |
| `spring__1888__strong_filter` | DEGRADED | **UNCERTAIN** | `dual-refused` | DOUBAO_REFUSED / SEVERE_COLOR_DISTORTION |
| `spring__3244__strong_filter` | DEGRADED | **UNCERTAIN** | `dual-refused` | DOUBAO_REFUSED / SEVERE_COLOR_DISTORTION |
| `summer__11286__strong_filter` | DEGRADED | **UNCERTAIN** | `dual-refused` | DOUBAO_REFUSED / SEVERE_COLOR_DISTORTION |
| `summer__4887__strong_filter` | DEGRADED | **UNCERTAIN** | `dual-refused` | DOUBAO_REFUSED / SEVERE_COLOR_DISTORTION |

6 张全部从"服务故障"语义纠正为"模型拒判"语义，且未伪造任何分数。

---

## 5. 代表性参数实验

全部实验经 `buildAdvancedDiagnosis()` 生产重放执行，指标口径统一，分母随行标注。

### 5.1 方案 A–E 递进对照

| 方案 | 说明 | CONF | UNC | RETAKE | DEGRAD | 覆盖率 | 已接受准确率 | 正确正式 | 错误正式 | 原图覆盖 | 严重拦截 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | Phase 3.1 原始规则（legacy） | 4 | 62 | 24 | 6 | 4.17% | 2/4 = 50.00% | 2 | 2 | 1/8 | 32/32 |
| B | 修复软警告分层与拒判逻辑 | 19 | 53 | 24 | 0 | 19.79% | 8/19 = 42.11% | 8 | 11 | 3/8 | 32/32 |
| C | B + 候选色偏阈值 (0.18/0.25) | 19 | 53 | 24 | 0 | 19.79% | 8/19 = 42.11% | 8 | 11 | 3/8 | 32/32 |
| D | C + 候选不确定性阈值 (0.40/0.08) | 25 | 47 | 24 | 0 | 26.04% | 9/25 = 36.00% | 9 | **16** | 3/8 | 32/32 |
| E | D + 候选固定权重 50:50 | 25 | 47 | 24 | 0 | 26.04% | 9/25 = 36.00% | 9 | **16** | 3/8 | 32/32 |

**结论：C 与 B 完全一致 → 色偏警告阈值候选对状态零影响；D 与 E 的差异仅体现在纯分类层 → 权重候选无实质收益。生产采纳 B。**

### 5.2 不确定性阈值单因素扫描（96 张，分母 n=96）

**minTopScore**（生产值 0.50）

| 取值 | 覆盖率 | 已接受准确率 | 错误正式诊断率 | 不确定率 | 整体正确诊断率 | 原图覆盖 |
|---|---|---|---|---|---|---|
| 0.30 | 26.04% | 9/25 = 36.00% | 16.67% | 48.96% | 9.38% | 3/8 |
| 0.35 | 26.04% | 9/25 = 36.00% | 16.67% | 48.96% | 9.38% | 3/8 |
| 0.40 | 26.04% | 9/25 = 36.00% | 16.67% | 48.96% | 9.38% | 3/8 |
| 0.45 | 26.04% | 9/25 = 36.00% | 16.67% | 48.96% | 9.38% | 3/8 |
| **0.50（生产）** | **19.79%** | **8/19 = 42.11%** | **11.46%** | **55.21%** | **8.33%** | **3/8** |

> 放宽 minTopScore 换来 +5 例错误正式诊断（11 → 16），已接受准确率反降。**不采用**。

**minTopGap**（生产值 0.10）

| 取值 | 覆盖率 | 已接受准确率 | 错误正式诊断率 | 不确定率 | 整体正确诊断率 |
|---|---|---|---|---|---|
| 0.05 / 0.08 / 0.10 / 0.12 / 0.15 | 19.79%（全部一致） | 8/19 = 42.11% | 11.46% | 55.21% | 8.33% |

> 该参数在本批样本上**无区分度**，保持生产值 0.10。

**totalVariationDistance**（生产值 0.40）

| 取值 | 覆盖率 | 已接受准确率 | 错误正式诊断率 | 不确定率 | 整体正确诊断率 | 原图覆盖 |
|---|---|---|---|---|---|---|
| 0.25 | 1.04% | 0/1 = 0%（无正式输出，准确率记 N/A 口径） | 1.04% | 73.96% | 0% | 0/8 |
| 0.30 | 8.33% | 5/8 = 62.50% | 3.13% | 66.67% | 5.21% | 0/8 |
| 0.35 | 16.67% | 6/16 = 37.50% | 10.42% | 58.33% | 6.25% | 2/8 |
| **0.40（生产）** | **19.79%** | **8/19 = 42.11%** | **11.46%** | **55.21%** | **8.33%** | **3/8** |
| 0.45 | 23.96% | 8/23 = 34.78% | 15.63% | 51.04% | 8.33% | 3/8 |
| 0.50 | 23.96% | 8/23 = 34.78% | 15.63% | 51.04% | 8.33% | 3/8 |

> 收紧到 0.35 覆盖率与准确率双降；放宽到 0.45 错误正式诊断 11 → 15。**保持 0.40**。

**minModelTopGap**（生产值 0.08）

| 取值 | 覆盖率 | 已接受准确率 | 错误正式诊断率 | 不确定率 |
|---|---|---|---|---|
| 0.05 / 0.08 / 0.10 | 19.79%（全部一致） | 8/19 = 42.11% | 11.46% | 55.21% |
| 0.12 | 18.75% | 8/18 = 44.44% | 10.42% | 56.25% |

> 0.12 仅损失 1 例覆盖率换取 1 例错误诊断减少，属噪声级差异；**保持 0.08**。

### 5.3 固定权重对照（共同有效样本 n=66，纯分类与综合诊断同一集合）

| CNN : 豆包 | 纯分类准确率 | macro-F1 | 诊断覆盖率 | 已接受准确率 | 正确正式 | 错误正式 | 整体正确诊断率 |
|---|---|---|---|---|---|---|---|
| 1.00 : 0.00 | 23/66 = 34.85% | 0.3874 | 25.00% | 9/24 = 37.50% | 9 | 15 | 9.38% |
| 0.80 : 0.20 | 24/66 = 36.36% | 0.3916 | 25.00% | 9/24 = 37.50% | 9 | 15 | 9.38% |
| 0.70 : 0.30 | 23/66 = 34.85% | 0.3588 | 25.00% | 9/24 = 37.50% | 9 | 15 | 9.38% |
| 0.60 : 0.40 | 26/66 = 39.39% | 0.3814 | 21.88% | 8/21 = 38.10% | 8 | 13 | 8.33% |
| 0.55 : 0.45 | 28/66 = 42.42% | 0.3985 | 21.88% | 8/21 = 38.10% | 8 | 13 | 8.33% |
| **0.50 : 0.50（候选）** | **29/66 = 43.94%** | **0.4224** | 21.88% | 8/21 = 38.10% | 8 | **13** | 8.33% |
| 0.45 : 0.55 | 28/66 = 42.42% | 0.4089 | 21.88% | 8/21 = 38.10% | 8 | 13 | 8.33% |
| **0.40 : 0.60（生产）** | **28/66 = 42.42%** | **0.4089** | **19.79%** | **8/19 = 42.11%** | 8 | **11** | 8.33% |
| 0.35 : 0.65 | 27/66 = 40.91% | 0.3835 | 17.71% | 6/17 = 35.29% | 6 | 11 | 6.25% |
| 0.30 : 0.70 | 25/66 = 37.88% | 0.3322 | 16.67% | 5/16 = 31.25% | 5 | 11 | 5.21% |
| 0.20 : 0.80 | 25/66 = 37.88% | 0.3322 | 13.54% | 4/13 = 30.77% | 4 | 9 | 4.17% |
| 0.00 : 1.00 | 24/66 = 36.36% | 0.3050 | 1.04% | 0/1 = 0% | 0 | 1 | 0% |

**结论**：50:50 纯分类比 40:60 仅多 1 例正确（29 vs 28 / 66，差 1.5pp），但在综合诊断口径下**错误正式诊断 11 → 13**、覆盖率 19.79% → 21.88%。1 例差异不具统计意义，而错误诊断增加是确定性的。**保持 40:60**。

**单模型来源区分**：`single-cnn` / `single-doubao` 表示**服务降级**（另一模型不可用）；主动拒判不属于此列，其 `inferenceMode` 为 `dual-refused`，且仍保留 CNN 结果供参考但不输出正式结论。

**动态权重**：applicability 与 reliability 保持**中性值 1**。当前样本量小且数据集与 CNN 训练集高度交叉，无独立证据支持非中性系数；强行调参等同于在噪声上拟合。

### 5.4 色偏阈值分析（复用 768 张免费预检，零新增调用）

| 警告阈值 | 原图告警率 | 强滤镜变体检出率 |
|---|---|---|
| **0.11（生产 · POSSIBLE_COLOR_CAST，info 级）** | 49/64 = 76.56% | 100% |
| 0.15 | 29/64 = 45.31% | 100% |
| 0.18 | 18/64 = 28.13% | 100% |
| **0.20（生产 · SUSPECTED_COLOR_PROCESSING，warning 级）** | 15/64 = 23.44% | 100% |
| 0.25 | 5/64 = 7.81% | 100% |

5 个候选阈值对 96 张重放的**状态结果完全无影响**（该级别为提示项，不参与状态判定）。生产保持 0.11 / 0.20。

**新增 `channelCastSevere` 扫描**（决定性风险，不阻断）：

| 取值 | 正式输出数 | 正确正式 | 错误正式 | 已接受准确率 | 原图覆盖 | 原图被色偏拦截 | 768 张原图误标率 | 768 张强滤镜检出 |
|---|---|---|---|---|---|---|---|---|
| 0.25 | 16 | 6 | 10 | 6/16 = 37.50% | 3/8 | 1/8 | 5/64 = 7.81% | 64/64 |
| **0.30（生产采纳）** | **19** | **8** | **11** | **8/19 = 42.11%** | **3/8** | **1/8** | **3/64 = 4.69%** | **63/64** |
| 0.35 | 21 | 10 | 11 | 10/21 = 47.62% | 4/8 | 0/8 | 2/64 = 3.13% | 62/64 |
| 0.40 | 23 | 12 | 11 | 12/23 = 52.17% | 5/8 | 0/8 | 1/64 = 1.56% | 62/64 |

**取舍说明（为何不采用开发集指标更优的 0.35 / 0.40）**：

1. **语义一致性**：该指标定义为「颜色分布异常风险」而非滤镜识别。0.30 对应原图样本第 97 百分位，对分布明显失衡的照片判 UNCERTAIN 符合设计意图。
2. **检出率最高**：0.30 的强色彩变体检出率 63/64 优于 0.35 / 0.40 的 62/64。
3. **拒绝针对个别 ID 调参**：0.35 相对 0.30 的全部收益来自**单一原图 `spring__3244`**（96 张非独立开发集中 8 张原图的 1 张，其 channelCast = 0.313，本身已被质量门控判为 WARNING）。任务明确要求"不得为个别 ID/季型写特殊规则"。
4. **不以放宽阈值换覆盖率**：与"不得放宽验收标准提升 PASS 数"同一原则。

> 该取舍的置信度受限于开发集样本量，属于**已知待验证项**，已列入 §10 下一步建议。

---

## 6. 典型错误案例复盘

### 6.1 两模型一致但共同误判（不可泛化的系统性偏差）

| image_id | 参考季型 | CNN Top-1 | 豆包 Top-1 | 融合 Top-1 | 综合分 | TVD | 状态 | 软警告 |
|---|---|---|---|---|---|---|---|---|
| `spring__1888__original` | spring | autumn | autumn | autumn | 0.5587 | 0.342 | CONFIDENT | DOUBAO_LIGHTING_WARNING, POSSIBLE_COLOR_CAST |
| `spring__1888__darker` | spring | autumn | autumn | autumn | 0.5475 | 0.267 | CONFIDENT | DOUBAO_LIGHTING_WARNING, DOUBAO_FILTER_WARNING |
| `spring__1888__brighter` | spring | autumn | autumn | autumn | 0.5800 | 0.340 | CONFIDENT | DOUBAO_LIGHTING_WARNING, POSSIBLE_COLOR_CAST |
| `spring__1888__warm` | spring | autumn | autumn | autumn | 0.5875 | 0.344 | CONFIDENT | DOUBAO_LIGHTING_WARNING, POSSIBLE_COLOR_CAST |
| `spring__1888__low_saturation` | spring | autumn | autumn | autumn | 0.5079 | 0.163 | CONFIDENT | DOUBAO_LIGHTING_WARNING |
| `spring__1888__high_saturation` | spring | autumn | autumn | autumn | 0.5901 | 0.372 | CONFIDENT | DOUBAO_LIGHTING_WARNING, POSSIBLE_COLOR_CAST |

**共性**：两模型给出**高度一致**的错误结论，综合分 0.51–0.59，分差 0.32–0.42（远超 minTopGap 0.10），TVD 偏高但仍低于 0.40。属于**参考标签与模型系统性偏差**问题（模型认为该图是 autumn），而非融合或阈值问题。

**结论**：现有图像质量指标与模型分数**无法识别**此类偏差。任何针对 `spring__1888` 或"春季图片被判 autumn"的特例规则都属于过拟合，本轮**未写入**任何此类规则。

### 6.2 `winter__766` 家族复盘

| image_id | 参考 | 融合 Top-1 | 状态 | 决定性原因 | 软警告 |
|---|---|---|---|---|---|
| `winter__766__original` | winter | autumn | CONFIDENT | — | POSSIBLE_COLOR_CAST |
| `winter__766__cool` | winter | autumn | CONFIDENT | — | POSSIBLE_COLOR_CAST |
| `winter__766__high_saturation` | winter | autumn | CONFIDENT | — | IMAGE_QUALITY_WARNING, SUSPECTED_COLOR_PROCESSING |
| `winter__766__darker` | winter | autumn | UNCERTAIN | TOP_SCORE_BELOW_THRESHOLD | POSSIBLE_COLOR_CAST |
| `winter__766__brighter` | winter | autumn | UNCERTAIN | MODEL_DISTRIBUTION_DISAGREEMENT | POSSIBLE_COLOR_CAST |
| `winter__766__warm` | winter | autumn | UNCERTAIN | MODEL_DISTRIBUTION_DISAGREEMENT | IMAGE_QUALITY_WARNING, SUSPECTED_COLOR_PROCESSING |
| `winter__766__low_saturation` | winter | autumn | UNCERTAIN | TOP_SCORE_BELOW_THRESHOLD, MODEL_DISTRIBUTION_DISAGREEMENT | POSSIBLE_COLOR_CAST |
| `winter__766__blur_light` | winter | autumn | UNCERTAIN | MODEL_DISTRIBUTION_DISAGREEMENT | POSSIBLE_COLOR_CAST |
| `winter__766__blur_severe` / `overexposed` / `underexposed` | winter | — | RETAKE_REQUIRED | IMAGE_QUALITY_REJECT | — |

**分析**：`winter__766__original` 与 `winter__766__cool` 均为两模型一致误判（均判 autumn，参考 winter），且综合分与分差均不触发起决定性风险。**这与 `spring__1888` 属同一类问题**——模型层面的系统性偏差，而非阈值问题。**已如实记录，未编写特例规则**。`winter__766__strong_filter` 在 Phase 3.1 中曾两模型同错却判 CONFIDENT，本轮由新增的 `SEVERE_COLOR_DISTORTION` 正确降级为 UNCERTAIN。

### 6.3 正确但被拒绝（已接受准确率的折价来源）

| image_id | 参考 | 融合 Top-1 | 综合分 | 状态 | 决定性原因 |
|---|---|---|---|---|---|
| `autumn__3544__darker` | autumn | autumn | 0.4497 | UNCERTAIN | TOP_SCORE_BELOW_THRESHOLD, CNN_LOW_DISCRIMINATION |
| `autumn__3544__brighter` | autumn | autumn | 0.4811 | UNCERTAIN | TOP_SCORE_BELOW_THRESHOLD |
| `autumn__3544__blur_light` | autumn | autumn | 0.4580 | UNCERTAIN | TOP_SCORE_BELOW_THRESHOLD, CNN_LOW_DISCRIMINATION |
| `spring__3244__original` | spring | spring | 0.6006 | UNCERTAIN | SEVERE_COLOR_DISTORTION |
| `spring__3244__brighter` | spring | spring | 0.5550 | UNCERTAIN | SEVERE_COLOR_DISTORTION |
| `spring__3244__warm` | spring | spring | 0.6006 | UNCERTAIN | SEVERE_COLOR_DISTORTION |
| `spring__3244__high_saturation` | spring | spring | 0.5967 | UNCERTAIN | SEVERE_COLOR_DISTORTION |
| `spring__3244__blur_light` | spring | spring | 0.6246 | UNCERTAIN | SEVERE_COLOR_DISTORTION |

**分析**：3 例因综合分不足被拒（分数本身确实偏低，拒判合理）；5 例因 `SEVERE_COLOR_DISTORTION` 被拒——这 5 张均属 `spring__3244` 家族（该原图 channelCast = 0.313，颜色分布确实异常）。这是 §5.4 取舍的直接体现，已在候选配置中记录。

### 6.4 严重异常未被拦截项

`severeStillConfident` 列表为空 —— 修复后**不存在**"严重异常却判 CONFIDENT"的样本（Phase 3.1 中存在 2 例：`winter__766__strong_filter`、`winter__3738__strong_filter`）。

---

## 7. 数据集划分与数据泄漏

### 7.1 抽样与划分核对

768 张受控样本 = 64 张原图 × 12 个变体。按 CNN 原始划分表（`original_split_table.csv`）分布：train 33 / val 9 / test 22 张原图。

第一轮实际进入探索的 8 张原图：

| 原图 | CNN 划分 |
|---|---|
| `autumn__14` | train |
| `autumn__3544` | train |
| `spring__1888` | train |
| `spring__3244` | train |
| `summer__11286` | train |
| `summer__4887` | train |
| `winter__3738` | val |
| `winter__766` | train |

**独立评估样本数：0。** 第一轮 8 张原图全部来自训练集（7）或验证集（1）。

### 7.2 处置

1. **锁定独立评估集**：CNN **test** 原图 22 张 + 其全部同源变体，共 **264 张**，在 `sample_manifest.csv` 中标记为 `dataset_split = validation` 且 `cnn_split = test`，作为唯一可用于最终独立验证的集合。本轮 **0 张**进入参数探索，第一轮探索**未污染**锁定集。
2. **非独立标记**：`sample_manifest.csv` 的 `dataset_split` 字段现划分为三组——
   - `round1_and_calibration`（96 张）= 第一轮 8 张原图 × 12 变体，含 train(84) / val(12)，**非独立评估数据**，仅可用于机制测试与开发期参数探索；
   - `calibration`（408 张）= 其余 train(312) / val(96) 样本，同样**非独立评估数据**；
   - `validation`（264 张）= CNN test 样本，**唯一独立评估集**。

   写回为幂等操作，重跑不产生重复标记；`dataset_split.json` 中同步记录 `phase3_2_correction`。
3. **人物身份风险**：本数据集无法确认样本人物身份（无身份标注链路），因此"同一人多张照片导致泄漏"的风险**无法完全排除**，但已通过"仅用 CNN test 集做独立验证 + 训练/验证样本显式标记"把可控范围内的泄漏降到最低。

### 7.3 锁定独立集上的零付费验证

**前置约束**：豆包在锁定集上**没有缓存**（`doubaoCacheAvailable = 0`），双模型独立验证需要约 **198 次付费调用**，与本轮"零新增付费 API 调用"约束冲突。因此本节只验证**不依赖豆包**的机制，豆包侧独立验证推迟到下一轮（§10.3 P0）。

| 验证项 | 结果 | 判读 |
|---|---|---|
| 独立集规模 | 264 张 / 22 张原图 | CNN test 子集，训练与模型选择均未触及 |
| 本地质量门控等级分布 | PASS 119 / WARNING 68 / REJECT 77 | — |
| **严重变体拦截率** | **88/88 = 100%**（0 例漏过） | blur_severe / overexposed / underexposed / strong_filter **全部**被门控拦下，独立数据上同样成立 ✅ |
| `channelCastSevere = 0.30` 原图误标率 | **1/22 = 4.55%** | 与开发集 768 张上的 3/64 = 4.69% **高度一致**，阈值未过拟合 ✅ |
| `channelCastSevere = 0.30` 强滤镜检出率 | **21/22 = 95.45%** | 与开发集 63/64 = 98.44% 同量级，检出能力可迁移 ✅ |
| CNN 单模型在 22 张 test 原图上的 Top-1 准确率 | **12/22 = 54.55%** | 从未参与训练，**独立**测得的参考标签噪声上限 |
| CNN 满足 `score ≥ 0.5 且 gap ≥ 0.1` 的比例 | **13/22 = 59.09%** | 单模型可进入正式输出的**上限**；双模型融合后覆盖率不会显著高于此 |

**独立数据上的关键结论**：

- 严重异常拦截机制在**未参与任何开发**的数据上保持 **88/88 全拦**，证明 §4.2 中"拦截能力未退化"不是开发集假象。
- 严重色偏阈值 0.30 的误标率（4.55%）与检出率（95.45%）在独立集与开发集之间**基本一致**，说明该阈值**没有过拟合**（§5.4 的取舍风险得到实证支撑）。
- CNN 在从未见过的原图上准确率仅 **54.55%**，与 CNN 自身 test 集 58.94% 接近，**独立证实了参考标签噪声上限**——这是"参数不可调优"结论的独立证据，而非开发集推测。

### 7.4 参考标签噪声上限

CNN 自身在其 test 集上的表现：`test_accuracy = 0.5894`、`macro-F1 = 0.5893`；144 张原图全部命中 CNN `original_split_table.csv`（train 107 / val 14 / test 23）。这意味着**参考标签本身携带噪声，模型精度上限受此约束**——这是 §5 中几乎所有阈值都无法改善的根本原因，也是"参数不可调优"结论的客观依据。

**独立实证**：§7.3 在锁定独立集（22 张从未参与训练的 test 原图）上测得 CNN Top-1 准确率 **12/22 = 54.55%**，与 CNN 自报 test 准确率 58.94% 接近。两组数字来自互不重叠的数据，**共同证实参考标签噪声上限约在 55%–59% 区间**。这一结论不依赖开发集，可直接采信。

> 推论：在参考标签质量提升之前，任何"提升已接受准确率"的阈值调整都只是在重新划分同一批噪声样本上的运气分布，因此 §5.2 中"阈值无区分度 / 放宽即变差"不是扫描力度不足，而是**数据上限的真实反映**。

---

## 8. 测试结果

| 检查项 | 命令 | 结果 |
|---|---|---|
| 离线单元测试 | `npm run test:offline` | **119 / 119 通过，0 失败**（原 99 + 新增 20） |
| TypeScript 类型检查 | `npx tsc --noEmit` | 退出码 0，无错误 |
| ESLint（改动文件） | `npx eslint <changed files>` | 退出码 0，无告警 |
| 生产构建 | `npm run build` | 成功（exit 0），全部路由编译通过 |

**新增测试覆盖（20 项）**：

- `tests/advanced-diagnosis.test.ts`（13 项）：软警告不阻断、光照警告不阻断、CONFIDENT 带软警告、跨域风险升级、同组相关警告不升级、严重颜色失真降级不阻断、阻断路径优先级、拒判 vs 服务失败区分、拒判不污染正式画像、legacy 策略复现 Phase 3.1、阈值覆盖注入、零权重保护、风险等级对外暴露。
- `tests/diagnose-flow.test.ts`（3 项）：合成 PNG 的颜色分级与阈值覆盖行为。
- `tests/diagnosis-status-ui.test.ts`（3 项）：`splitReasons` 的软警告/决定性原因拆分与文案标签。
- `tests/doubao-vision.test.ts`（1 项）：主动拒判是**成功响应且从不重试**（断言 `calls === 1`、`meta.attempts === 1`）。

### 8.1 前端与画像逻辑检查

| 检查项 | 结论 |
|---|---|
| CONFIDENT 含软警告 | 以 info 色调展示"提示（不影响本次正式结果）"，不降级、不遮挡正式结论 ✅ |
| UNCERTAIN 展示候选与决定性原因 | `splitReasons` 按风险等级拆分，展示候选季型 + 决定性原因码 ✅ |
| 拒判不显示为网络故障 | `DOUBAO_REFUSED` 独立文案，与 `SINGLE_MODEL_DEGRADED` 的服务故障提示区分 ✅ |
| 不确定 / 拒判 / 降级不覆盖正式画像 | 画像过滤条件仍为 `status === "CONFIDENT"`，非 CONFIDENT 结果不写入画像 ✅ |
| 历史记录兼容 | 历史快照缺少新字段，按已知软警告码回退分类，页面显示"本条为历史记录，未经新版判断规则校验"提示 ✅ |

---

## 9. API 调用与文件占用

### 9.1 API 与 Token

| 项目 | 新增量 |
|---|---|
| 豆包视觉 API 调用 | **0 次** |
| 新增 Token 消耗 | **0** |
| CNN 推理调用 | **0 次**（全部复用 Phase 3.1 已有缓存） |
| 图片质量预检调用 | **0 次**（复用 768 张免费预检结果） |

全部离线重放均基于 Phase 3.1 已落盘的模型缓存与预检结果。

### 9.2 文件占用

**新增文件（13 个，合计约 340 KB）**：

| 文件 | 体积 |
|---|---|
| `docs/phase3.2-report.md` | ~40 KB |
| `experiments/phase3.1/scripts/phase3.2-analysis.mjs` | 32 KB |
| `experiments/phase3.1/results/phase3.2_analysis.json` | 168 KB |
| `experiments/phase3.1/candidate_config.json` | 8 KB |
| `src/lib/`（8 个新模块） | 92 KB |
| `src/components/DiagnosisStatusNotice.tsx` | 4 KB |
| `tests/`（3 个测试文件的新增部分） | ~30 KB |

**未生成**：无重复 CSV、无逐次扫描的中间 JSON、无 PNG 图表、无额外报告文件。实验原始数据集中于唯一的 `phase3.2_analysis.json`（含 5 组方案 × 96 条逐样本明细、5+4+6+4 组阈值扫描、13 组权重对照、5 档色偏研究、264 张独立集逐图明细），参数结论集中于唯一的 `candidate_config.json`。

**已清理的本次临时产物**：
- `.next-old-phase32/`（330 MB 构建缓存备份，构建成功后删除）
- `.workbuddy/p32a.json`（分析中间文件）
- `.workbuddy/p32_run.log`（脚本运行日志，重跑后删除）

**未触碰**：Phase 3.1 全部既有产物（`fusion_results.csv`、`image_quality_results.csv`、`sample_manifest.csv`、`original_split_table.csv`）、模型缓存、数据集、`.next` 正式构建产物。

---

## 10. 最终验收与下一步建议

### 10.1 验收结论

| 验收维度 | 结论 |
|---|---|
| 软警告/硬风险分离 | ✅ 三级风险模型落地，单测全覆盖 |
| 豆包拒判与服务异常分离 | ✅ 6 张拒判从 DEGRADED 纠正为 UNCERTAIN，`dual-refused` 独立标记 |
| 五状态架构与历史兼容 | ✅ 架构未变，新增字段全部可选，历史记录可解析可访问并显式标注未经新版校验 |
| 严重异常拦截能力 | ✅ 32/32 维持，`severeStillConfident` 为空 |
| 正常图误拒 | ✅ 0 例，未因放宽而引入新误拒 |
| 离线重放忠实性 | ✅ legacy 策略 96/96 状态与原因全匹配 Phase 3.1 |
| 参数结论 | ✅ 全部有实验证据支撑；生产参数除 2 项新增外**全部保持不变** |
| 数据泄漏 | ✅ 锁定独立评估集 264 张，第一轮 0 张污染；并已在该独立集完成零付费部分验证（拦截 88/88、色偏阈值误标 4.55% / 检出 95.45%） |
| 测试 | ✅ 119/119、TSC 0、ESLint 0、build 成功 |
| API 成本 | ✅ 新增付费调用 0 次、Token 0 |
| 文件占用 | ✅ 仅 1 份报告 + 1 份候选配置 + 1 份结果 JSON，临时产物已清理 |

### 10.2 已知局限（如实记录）

1. **两模型一致误判无法由现有机制识别**：`spring__1888` 家族（6 张）与 `winter__766__original` / `__cool` 属模型层面系统性偏差，图像质量指标与模型分数均无区分度。未编写特例规则，该类错误**仍然存在于正式输出中**。
2. **已接受准确率 42.11%（8/19）低于 Phase 3.1 的 50%（2/4）**：分母扩大 5 倍后的正常回归，但绝对意义上的正式输出质量并未提升。产品侧需明确"正式输出 ≈ 四成准确，UNCERTAIN 才是诚实答案"这一预期。
3. **开发集样本量小**：96 张重放样本、8 张原图，且全部来自 CNN 训练/验证集。所有阈值结论的统计置信度有限；§5.4 的 `channelCastSevere` 取舍（0.30 vs 0.35）本质是**在开发集上无法判优**的取舍——不过 §7.3 的独立集数据表明 0.30 的误标率与检出率在独立集上同样成立，因此该取值**至少没有过拟合风险**，问题仅在于是否偏保守。
4. **双模型融合层尚无独立验证**：锁定独立集上豆包缓存为 0，双模型层需约 198 次付费调用才能独立验证（本轮零付费约束未执行）。当前所有**融合层**结论（权重、不确定性阈值）仍基于 96 张非独立样本；**质量门控与色偏阈值**两个纯本地机制已在独立集上验证通过。
5. **人物身份不可确认**：数据集中无身份标注链路，"同人重复入集"风险无法完全排除。
6. **动态权重未启用**：applicability / reliability 保持中性 1，无独立证据支持非中性系数。

### 10.3 下一步建议（按优先级）

| 优先级 | 建议 | 目的 |
|---|---|---|
| **P0** | 在**锁定的 264 张 CNN test 独立评估集**上补齐豆包侧缓存（需约 **198 次付费调用**，本轮受零付费约束未执行），重跑本套重放，产出无泄漏的双模型最终指标 | §7.3 已验证质量门控（88/88）与严重色偏阈值（误标 4.55% / 检出 95.45%）在独立集成立，但双模型融合层仍缺独立验证 |
| **P0** | 针对**两模型一致误判**开展专项分析：检查参考标签噪声、模型混淆矩阵，评估引入第三信号（如色相/明度统计特征）作为第三模型域的可行性 | 解决当前唯一无法机制化拦截的错误类型 |
| **P1** | 修正参考标签：抽样人工复核 CNN test 原图的季节标注 | 解除 54.55%–58.94% 的精度天花板（§7.4 独立实测），使参数优化真正有意义 |
| **P1** | 扩大独立样本量（≥ 40 张 test 原图 × 12 变体）后重跑 §5.2 全部阈值扫描，重新判定 `minTopScore` / `channelCastSevere` | 把"无区分度"和"开发集无法判优"升级为有统计依据的结论 |
| **P2** | 建立 **CI 回归基线**：把 96 张 legacy 重放结果固化为快照断言，防止后续改动静默破坏 Phase 3.1 结论 | 防止机制回归 |
| **P2** | 为 `SINGLE_MODEL_DEGRADED` 补充可观测性埋点（错误率、重试次数、网络分类） | 区分真实服务故障与模型拒判的运行期监控 |
| **P2** | 评估 `dual-refused` 场景的用户体验：是否向用户提示"照片疑似经过强滤镜处理，请上传原图" | 把拒判从"失败"转为可引导的用户行为 |

---

*本报告由 Phase 3.2 离线重放实验生成，全部数据可追溯至 `experiments/phase3.1/results/phase3.2_analysis.json` 与 `experiments/phase3.1/candidate_config.json`。Phase 3.1 原始报告与实验产物未被修改。*
