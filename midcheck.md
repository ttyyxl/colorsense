# ColorSense 技术方案中期检查报告

## 审计范围

本报告基于只读检查整理，未修改业务代码。检查依据：

- 当前实现代码：`src/`、`inference_service/`、`firestore.rules`、`package.json`、`.env.example`
- 当前路线文档：`MEMORY.md`、`README.md`
- 上传的历史需求文档：`ColorSense_PRD_v1.docx`、`ColorSense_AgentPrompt.md`
- Deep Armocromia 官方资料与 PyTorch/Torchvision 官方资料

说明：PRD 与 AgentPrompt 记录的是较早的 `Supabase + Storage + Claude` 方案；当前最终技术路线已改为 `Firebase Auth + Firestore + FastAPI`。因此 Supabase 相关内容不作为当前方案验收要求，但遗留代码与依赖属于待处理技术债。

## 一、总体完成情况

### 1. 已完成

- Next.js 14 + TypeScript + Tailwind 前端项目结构已存在。
- 首页、登录页、上传页、结果详情页、历史记录页已实现。
- Firebase Authentication 初始化已实现。
- Firebase 邮箱密码注册、验证邮件发送、验证回跳处理、邮箱密码登录已实现。
- Firebase Google 登录与退出登录已实现。
- 登录状态监听与受保护页面客户端拦截已实现。
- Firestore 诊断记录创建、读取、列表查询、删除已实现。
- Firestore Security Rules 已提供，限制已验证邮箱用户或 Google 用户访问本人记录。
- 图片上传到 Next.js API，再调用 FastAPI 的主调用链已实现。
- FastAPI `/diagnose` 图片接口、人脸检测、LAB 特征提取已实现。
- 结果页 PNG 本地下载已实现。
- 邮件发送诊断结果、自建验证码接口已停用并返回废弃提示。

### 2. 部分完成

- `/processing` 页面存在，但实际诊断流程未经过该页面，也没有按旧 PRD 实现分阶段轮播与完成后跳转。
- 上传页支持点击和拖拽，但未发现粘贴上传与示例好/坏照片展示。
- 结果页可显示建议文案，但当前内容来自静态季型配置，不是 LLM 个性化生成。
- FastAPI 可返回四季结果，但当前分类由 LAB 距离规则计算，不是真实训练模型。
- Firebase 功能代码已完成，但真实邮件、Google OAuth、Firestore Rules 发布状态依赖控制台配置与浏览器实测。
- 当前路由保护主要为客户端 `ProtectedRoute`；Firestore 数据访问有 Rules 保护，但还没有 Firebase Admin / ID token 级的服务端 API 鉴权。

### 3. 未完成

- Deep-Armocromia 数据集训练流程。
- EfficientNet-B0 四分类迁移学习训练。
- `best_model.pth` 或 ONNX 模型文件。
- `inference_service/models/` 模型目录。
- `label_map.json`。
- FastAPI 深度学习模型加载和推理。
- 真实模型输出四类概率的端到端联调。
- 生产环境部署与监控验证。

### 4. 存在问题或风险

| 风险 | 严重度 | 说明 |
|---|---:|---|
| 当前 AI 结果不来自训练模型 | 高 | `inference_service/season_classifier.py` 只是 LAB 中心距离规则，不满足最终真实模型路线。 |
| FastAPI 失败会自动回退 mock | 高 | `src/app/api/diagnose/route.ts` 会生成规则化 mock 结果；演示可用，但测试时必须明确结果来源。 |
| 登录页有旧文案 | 中 | `src/app/login/page.tsx` 仍写“邮箱验证码设置密码”，与当前 Firebase 验证链接流程不一致。 |
| 旧依赖与旧文件仍保留 | 中 | `package.json` 仍包含 Supabase 与 `resend`；`src/lib/supabase*`、`smtp.ts`、`auth-codes.ts` 仍存在，容易误用。 |
| 处理中页面未接入真实流程 | 中 | 用户点击诊断后在上传页等待，而不是进入 `/processing`。 |
| Firestore Rules 需部署确认 | 中 | 仓库有规则文件，但无法仅由本地代码证明已在 Firebase Console 发布。 |
| Firebase OAuth / 邮件链路需真实联调 | 中 | 代码完成不等于控制台 Provider、Authorized domains、OAuth redirect URI 均已正确配置。 |
| PRD 与最终路线不一致 | 低 | 上传的旧 PRD/Prompt 仍描述 Supabase/Claude，应标识为历史文档，避免后续误实现。 |

### 5. 下一步建议

1. 优先完成 Firebase 与 Firestore 的真实浏览器联调，确保注册、验证、Google 登录、规则发布均可用。
2. 在 Kaggle 建立 Deep-Armocromia 四分类训练 Notebook，先产出可复现 baseline。
3. 训练并导出 `best_model.pth` 与 `label_map.json`，可选同步导出 ONNX。
4. 在本地 FastAPI 接入真实模型，并让响应明确区分 `model` 与 `mock` 来源。
5. 再处理 UI 小缺口、旧依赖清理与生产部署。

## 二、前端完成情况

| 模块 | 状态 | 相关文件 | 说明 | 还需要做什么 |
|---|---|---|---|---|
| 首页 | 已完成核心功能 | `src/app/page.tsx` | 有 Hero、CTA、功能卡和四季示例卡片 | 如按旧 PRD 完善，可补 Footer/GitHub 链接 |
| 登录/注册页面 | 已完成核心功能 | `src/app/login/page.tsx`、`src/components/AuthForm.tsx` | 邮箱注册、邮箱登录、Google 登录整合在 `/login` | 修正“邮箱验证码设置密码”旧文案 |
| Firebase 初始化 | 已完成 | `src/lib/firebase.ts` | 使用六项 `NEXT_PUBLIC_FIREBASE_*` 配置并导出 `auth`、`db` | 与 Firebase Console Web App 最终核对 |
| Firebase 邮箱注册 | 已完成代码 | `src/components/AuthForm.tsx` | 使用 `createUserWithEmailAndPassword` | 浏览器实际注册测试 |
| Firebase 邮箱验证邮件 | 已完成代码 | `src/components/AuthForm.tsx` | 使用 `sendEmailVerification` 与 `NEXT_PUBLIC_APP_URL/login?verified=1` | Firebase Authorized domains 配置与真实邮件测试 |
| 验证回跳 | 已完成代码 | `src/components/AuthForm.tsx` | `verified=1` 时刷新当前用户，验证成功后跳转 `/upload` | 测试有 session / 无 session 两条路径 |
| 邮箱密码登录 | 已完成代码 | `src/components/AuthForm.tsx` | 使用 Firebase 登录，并检查 `emailVerified` | 真账号联调 |
| Google 登录 | 已完成代码 | `src/components/AuthForm.tsx` | 使用 `GoogleAuthProvider` 与 `signInWithPopup` | Google OAuth Console 配置完成后实测 |
| 退出登录 | 已完成 | `src/components/Navbar.tsx`、`src/components/AuthProvider.tsx` | 使用 Firebase `signOut` | 浏览器联调 |
| 登录状态保持 | 已完成代码 | `src/components/AuthProvider.tsx` | 使用 `onAuthStateChanged` 恢复用户状态 | 刷新页面实测 |
| 未登录访问受保护页面 | 已完成客户端保护 | `src/components/ProtectedRoute.tsx` | `/upload`、`/processing`、`/result`、`/history` 均套用保护组件 | 如需服务端强保护，引入 Firebase Admin session |
| 邮箱未验证限制上传 | 已完成 | `src/components/ProtectedRoute.tsx` | 非 Google 用户必须 `emailVerified` | 真用户验证测试 |
| 上传页面 | 已完成核心功能 | `src/app/upload/page.tsx`、`src/components/UploadZone.tsx` | 拖拽/点击上传、预览、格式和 10MB 限制、提交诊断 | 粘贴上传、示例照片未实现 |
| 处理中页面 | 部分完成 | `src/app/processing/page.tsx` | 静态加载 UI 已有 | 接入真实上传流程、分阶段轮播、完成跳转 |
| 结果页面 | 已完成核心功能 | `src/app/result/[id]/page.tsx` | 从 Firestore 读详情，展示季型、色卡、建议、时间 | 接入真实模型后验证结果解释 |
| 历史记录页面 | 已完成核心功能 | `src/app/history/page.tsx` | 从 Firestore 查询、查看详情、删除记录 | 删除确认弹窗未见实现 |
| 保存结果到 Firestore | 已完成代码 | `src/components/UploadZone.tsx`、`src/lib/firestore-diagnoses.ts` | 诊断后通过 `addDoc` 保存 | 发布并实测 Firestore Rules |
| 历史从 Firestore 读取 | 已完成代码 | `src/lib/firestore-diagnoses.ts` | 按 `userId` 查询并本地倒序排序 | 真数据实测 |
| 本地结果导出 | 已完成 | `src/components/ShareModal.tsx` | 使用 `html2canvas` 下载 PNG，不发送邮箱 | 如需严格符合旧设计，可优化卡片固定尺寸/品牌元素 |

### 前端结论

当前前端 MVP 主链路已经具备代码实现：

```text
Firebase 登录/验证 -> 上传图片 -> Next.js API -> Firestore 保存 -> 结果页/历史页 -> PNG 下载
```

仍需真实 Firebase 控制台联调和 UI 细节收尾。`/processing` 尚未纳入真实用户流程。

## 三、后端完成情况

| 模块 | 状态 | 相关文件 | 说明 | 还需要做什么 |
|---|---|---|---|---|
| FastAPI 项目结构 | 已完成 | `inference_service/main.py`、`inference_service/requirements.txt` | 后端服务目录与入口存在 | 接入模型部署文件 |
| `/health` 接口 | 已完成 | `inference_service/main.py` | 返回服务状态 | 本地启动验证 |
| `/diagnose` 接口 | 已完成 | `inference_service/main.py` | 接收图片并返回分类数据 | 用真实模型替换规则分类 |
| 接收图片上传 | 已完成 | `inference_service/main.py` | 支持 JPEG/PNG/WebP/HEIC/HEIF，限制 10MB | HEIC 实际解码兼容性需测试 |
| 人脸检测 | 已完成 MVP | `inference_service/face_detector.py` | 使用 MediaPipe Face Detection 提取人脸区域 | 可升级到更精确的分割/关键点方案 |
| 图像预处理 | 部分完成 | `inference_service/face_detector.py`、`inference_service/color_extractor.py` | 裁剪中心下半脸并提取 LAB 均值 | 真实 CNN 推理所需 resize/normalize 尚未实现 |
| 四季分类 | 仅规则 MVP | `inference_service/season_classifier.py` | 按 LAB 参考中心计算距离和分数 | 替换为 EfficientNet-B0 模型输出 |
| 是否调用真实模型 | 未完成 | `inference_service/` | 无模型加载代码 | 新增 PyTorch 或 ONNX 推理器 |
| 是否仍有 mock 结果 | 是，前端 API fallback | `src/app/api/diagnose/route.ts` | FastAPI 不可用或异常时返回 mock | 调试时保留；上线时应显式展示来源或限制使用 |
| `models/` 目录 | 未完成 | `inference_service/` | 当前不存在 | 创建 `inference_service/models/` |
| 模型加载代码 | 未完成 | `inference_service/` | 未找到 `torch.load` 或 `onnxruntime.InferenceSession` | 新增 inference loader |
| `label_map.json` | 未完成 | `inference_service/` | 当前不存在 | 训练导出后保存 |
| `requirements.txt` | 已完成但待扩展 | `inference_service/requirements.txt` | 含 FastAPI、MediaPipe、OpenCV、`onnxruntime` | `.pth` 路线需加入 `torch` / `torchvision`；ONNX 路线核对导出依赖 |
| 本地启动能力 | 代码具备，未在本次实测 | `inference_service/main.py` | 可通过 `uvicorn main:app --reload` 启动设计 | 安装依赖后实际运行 `/health`、`/diagnose` |
| 前端调用 FastAPI | 已完成代码 | `src/app/api/diagnose/route.ts` | 通过 `INFERENCE_SERVICE_URL/diagnose` 转发图片 | 真实服务与模型接入后端到端测试 |

### 后端结论

FastAPI 服务外壳和规则型 MVP 推理已经存在，但最终目标中的“训练好的四季色彩分类模型”尚未接入。当前结果只能称为基于人脸肤色 LAB 特征的规则 baseline，不能称为 EfficientNet-B0 模型诊断结果。

## 四、Kaggle 模型训练计划

### 1. Kaggle Notebook 应该怎么创建

1. 在 Kaggle 新建 Notebook。
2. 在右侧 `Settings -> Accelerator` 选择 GPU，例如当前可用的 T4 GPU。
3. 打开 Internet 仅在需要安装额外包或拉取公开资源时使用。
4. Notebook 建议命名：

```text
colorsense-deep-armocromia-efficientnet-b0-4class.ipynb
```

5. 固定随机种子，记录库版本、数据文件结构、训练参数与结果指标。

推荐 Notebook 章节：

```text
00 Environment and Seed
01 Dataset Inspection
02 Annotation Mapping and Split
03 Dataset / Dataloader
04 Model Definition
05 Training and Validation
06 Test Evaluation
07 Export Artifacts
08 ONNX Export Optional
09 Inference Sanity Check
```

### 2. 数据集应该怎么添加

优先顺序：

1. 如果 Deep-Armocromia 已在 Kaggle Dataset 中可用，使用 `Add Input` 添加数据集。
2. 如果数据来自官方 GitHub 或授权下载包，将本地压缩包上传为 Private Kaggle Dataset，再绑定 Notebook。
3. 数据使用前确认许可、用途限制和是否允许随项目发布模型权重。

Deep Armocromia 官方资料显示，该数据集约有 4,920 张人脸图像，包含四主季型及十二子型，并涉及面部掩膜处理。

### 3. 如何解压 Deep-Armocromia 数据集

不要预设压缩包名称。先查看输入目录：

```python
from pathlib import Path

INPUT_ROOT = Path("/kaggle/input")
for path in INPUT_ROOT.rglob("*"):
    if path.is_file():
        print(path)
```

如果输入为 `.zip`：

```python
import zipfile
from pathlib import Path

archive = Path("/kaggle/input/<dataset-slug>/<archive-name>.zip")
work_dir = Path("/kaggle/working/deep_armocromia")
work_dir.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(archive) as zf:
    zf.extractall(work_dir)
```

之后再次打印目录，确认：

```text
annotations.csv
原图目录
masked RGB 或 mask 目录（如数据包提供）
```

### 4. 如何读取 `annotations.csv`

当前可验证资料没有给出你所持数据包的准确 CSV 列名，第一步必须检查实际字段：

```python
import pandas as pd
from pathlib import Path

csv_path = next(Path("/kaggle/working/deep_armocromia").rglob("annotations.csv"))
df = pd.read_csv(csv_path)

print(df.head())
print(df.columns.tolist())
print(df.dtypes)
print(df.shape)
```

然后找出：

- 图片文件路径列
- 主季型或子类型标注列
- 是否有 split 列
- 是否有原图/掩膜图路径列

之后统一构造内部字段：

```python
records = pd.DataFrame({
    "image_path": df["<实际图片路径列>"],
    "raw_label": df["<实际季型列>"],
})
```

### 5. 意大利标签映射为四分类

如果实际标签为意大利语主类别：

```python
LABEL_NORMALIZE = {
    "primavera": "spring",
    "estate": "summer",
    "autunno": "autumn",
    "inverno": "winter",
    "spring": "spring",
    "summer": "summer",
    "autumn": "autumn",
    "winter": "winter",
}

records["label"] = (
    records["raw_label"]
    .astype(str)
    .str.strip()
    .str.lower()
    .map(LABEL_NORMALIZE)
)

assert records["label"].notna().all(), records[records["label"].isna()]
```

类别索引文件应固定，例如：

```json
{
  "0": "spring",
  "1": "summer",
  "2": "autumn",
  "3": "winter"
}
```

FastAPI 必须使用与训练完全相同的类别映射。

### 6. 如何划分 train / validation / test

若数据集官方已提供 split，应优先使用官方 split，便于与论文指标比较。

如果未提供，建议按类别分层划分：

```python
from sklearn.model_selection import train_test_split

train_df, temp_df = train_test_split(
    records,
    test_size=0.20,
    stratify=records["label"],
    random_state=42,
)

val_df, test_df = train_test_split(
    temp_df,
    test_size=0.50,
    stratify=temp_df["label"],
    random_state=42,
)
```

比例为：

```text
train: 80%
validation: 10%
test: 10%
```

重要风险：如果同一人物存在多张照片，应尽量按 identity 分组划分，而不是随机按图片划分，否则同一人物可能同时进入训练和测试集，导致指标虚高。

### 7. 推荐使用原图还是 masked RGB 图片

建议主实验使用 `masked RGB`，并保留原图 baseline 对照。

理由：

- 该任务判断依据集中在脸部、皮肤、头发、眼睛等区域。
- 背景、服装、滤镜容易产生伪相关特征。
- Deep Armocromia 公开论文资料描述了面部特征区域隔离与 RGB-masked 图像用于模型优化的处理路线。

推荐实验组合：

| 实验 | 输入 | 用途 |
|---|---|---|
| Baseline A | 原图 crop | 判断最简单数据管道效果 |
| Main B | masked RGB | 作为主模型候选 |
| Optional C | 原图 + 非颜色增强 | 检查对实际自拍场景的稳健性 |

不要使用改变色彩属性的增强，例如强烈 `ColorJitter`、色相偏移或灰度化，因为季节色彩分类依赖颜色本身。

### 8. 推荐的训练代码结构

Kaggle 初版可写在一个 Notebook 内；确定稳定后再整理为脚本：

```text
training/
  dataset.py
  transforms.py
  model.py
  train.py
  evaluate.py
  export_onnx.py
```

推荐训练配置：

```python
NUM_CLASSES = 4
IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 20
LEARNING_RATE = 3e-4
WEIGHT_DECAY = 1e-4
CLASS_NAMES = ["spring", "summer", "autumn", "winter"]
```

推荐模型方式：

```python
import torch.nn as nn
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights

weights = EfficientNet_B0_Weights.IMAGENET1K_V1
model = efficientnet_b0(weights=weights)
model.classifier[1] = nn.Linear(model.classifier[1].in_features, 4)
```

推荐预处理：

```python
train_transforms = [
    Resize((224, 224)),
    RandomHorizontalFlip(),
    RandomRotation(small_angle),
    ToTensor(),
    Normalize(imagenet_mean, imagenet_std),
]

val_test_transforms = [
    Resize((224, 224)),
    ToTensor(),
    Normalize(imagenet_mean, imagenet_std),
]
```

训练策略：

1. 第一阶段冻结 backbone，只训练分类头 3 到 5 epochs。
2. 第二阶段解冻后部 block 或全部模型，以更小学习率微调。
3. 损失函数使用 `CrossEntropyLoss`。
4. 优化器使用 `AdamW`。
5. 以 validation macro F1 或 validation accuracy 保存最佳权重。
6. 最终只在 test split 上评估一次。

建议保存指标：

```text
accuracy
macro precision
macro recall
macro F1
confusion matrix
per-class recall
```

### 9. 推荐保存哪些文件

训练产物建议保存：

```text
best_model.pth
label_map.json
training_config.json
metrics.json
confusion_matrix.png
class_distribution.csv
split_manifest.csv
optional: colorsense_efficientnet_b0.onnx
```

`best_model.pth` 建议保存结构明确的 checkpoint：

```python
torch.save({
    "model_state_dict": model.state_dict(),
    "class_to_idx": class_to_idx,
    "image_size": 224,
    "architecture": "efficientnet_b0",
    "val_metrics": best_metrics,
}, "best_model.pth")
```

### 10. 下载到本地后应该放到哪个目录

当前项目尚无模型目录。目标结构应为：

```text
inference_service/
  models/
    best_model.pth
    label_map.json
    colorsense_efficientnet_b0.onnx   # 可选
  model_inference.py
  main.py
  requirements.txt
```

如果使用 ONNX 作为部署格式，则 FastAPI 默认加载 `.onnx`；`.pth` 可作为训练归档或本地验证文件。

### 11. FastAPI 应该如何加载模型

有两条路线：

| 路线 | 优点 | 缺点 | 建议 |
|---|---|---|---|
| PyTorch `.pth` | 接入直接，调试方便 | 运行依赖体积较大 | 首次接入与验证使用 |
| ONNX + `onnxruntime` | 推理部署更轻，仓库已有依赖 | 需保证导出和预处理一致 | 稳定后部署优先 |

建议先用 `.pth` 完成正确性联调，再导出 ONNX。

FastAPI 接入应包括：

```text
1. 服务启动时只加载一次模型
2. 接收图片字节
3. 解码为 RGB
4. 应用与训练一致的 resize 和 normalize
5. 执行模型前向推理
6. softmax 得到四类概率
7. 通过 label_map 映射最终类别
8. 返回 season、confidence、scores
```

目标响应应兼容当前 Next.js API：

```json
{
  "season": "spring",
  "confidence": 0.73,
  "scores": {
    "spring": 0.73,
    "summer": 0.12,
    "autumn": 0.10,
    "winter": 0.05
  }
}
```

### 12. 当前项目接入真实模型还缺什么

| 缺失项 | 用途 |
|---|---|
| Kaggle Notebook 或训练脚本 | 训练 EfficientNet-B0 |
| 实际数据集读取与 label mapping | 形成四分类训练样本 |
| 分层或按身份隔离的数据切分 | 防止数据泄漏 |
| `best_model.pth` | PyTorch 推理权重 |
| `label_map.json` | 后端解释类别索引 |
| 可选 ONNX 文件 | 轻量部署推理 |
| `inference_service/models/` | 存放模型产物 |
| `model_inference.py` | 模型加载、预处理、softmax 推理 |
| `main.py` 接线修改 | 将规则分类替换或切换为模型分类 |
| 模型相关 requirements | PyTorch 或 ONNX 的完整运行依赖 |
| 单元测试与样例图片测试 | 验证模型接口、四类输出和异常路径 |
| 模型来源标记 | 防止 mock / rules / trained model 结果混淆 |

## 五、文档与最终路线一致性

| 文档 | 状态 | 结论 |
|---|---|---|
| `MEMORY.md` | 当前路线基本准确 | 已描述 Firebase、Firestore、FastAPI 以及 EfficientNet-B0 训练计划 |
| `README.md` | 当前路线基本准确 | 已描述 Firebase 邮箱验证回跳、Firestore 与训练计划 |
| `ColorSense_PRD_v1.docx` | 历史方案 | 仍以 Supabase、Claude、Storage 为主，与最终路线不一致 |
| `ColorSense_AgentPrompt.md` | 历史执行提示 | 同样保留旧 Supabase/Claude 方案，不能直接用于继续开发 |

建议后续为 PRD 与 AgentPrompt 增加明显标记：

```text
Deprecated architecture reference: Supabase/Claude flow has been replaced by Firebase Auth + Firestore + FastAPI.
```

当前文档另有两个值得修正的点：

- 登录页实际 UI 文案仍引用“邮箱验证码设置密码”，应改为 Firebase 邮箱验证链接描述。
- `README.md` / `MEMORY.md` 应继续明确 FastAPI 当前是规则 baseline，只有模型接入后才称为 EfficientNet-B0 推理。

## 最优先 To-do List

| 优先级 | 任务 | 完成标准 |
|---:|---|---|
| P0 | 完成 Firebase 真机/浏览器联调 | 邮箱注册、验证回跳、有/无 session、Google 登录、退出、受保护路由全部通过 |
| P0 | 发布并验证 Firestore Rules | 已验证邮箱用户和 Google 用户只可读写本人诊断记录 |
| P1 | 建立 Kaggle 四分类训练 Notebook | 能读取 Deep-Armocromia、映射标签、划分数据并训练 EfficientNet-B0 baseline |
| P1 | 导出模型产物 | 获得 `best_model.pth`、`label_map.json`、评估指标，可选 ONNX |
| P1 | 接入 FastAPI 真实推理 | `/diagnose` 返回模型 softmax 四类概率，前端保存 `source: model` 或等价标识 |
| P2 | 做端到端真实模型联调 | 上传真实照片后结果来自模型而不是 mock/rules，结果页与历史页正常 |
| P2 | 修正轻微 UI/文档不一致 | 登录页移除“验证码设置密码”旧表述；历史 PRD 标记为 deprecated |
| P3 | 优化产品细节 | 接入 `/processing` 流程、删除确认弹窗、移动端和导出卡片视觉验证 |
| P3 | 清理遗留技术债 | 在明确授权后移除 Supabase/Resend/SMTP/验证码遗留文件与依赖 |

## 参考资料

- Deep Armocromia 官方项目页：<https://lorenzo-stacchio.github.io/Deep-Armocromia/>
- Deep Armocromia ECCV 2024 Poster：<https://lorenzo-stacchio.github.io/Deep-Armocromia/static/pdfs/POSTER_ECCV_Armocromia.pdf>
- Torchvision EfficientNet 官方文档：<https://docs.pytorch.org/vision/master/models/efficientnet.html>
- Torchvision 预训练权重文档：<https://docs.pytorch.org/vision/stable/models>
- `timm` 文档：<https://timm.fast.ai/>
