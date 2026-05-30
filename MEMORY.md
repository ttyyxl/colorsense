# ColorSense Project Memory

最后更新时间：2026-05-28

> 本节为当前权威项目记忆。下方旧版记录保留为历史上下文，其中部分内容已经过时；以后开发应优先参考本节。

## 项目当前状态

- 项目名称：ColorSense / ColorInsight。
- 产品定位：面向用户上传人像照片的四季色彩诊断 Web App，输出 `spring` / `summer` / `autumn` / `winter` 四分类结果、色卡、风格关键词、AI 建议和历史记录。
- 前端技术栈：Next.js 14、React、TypeScript、Tailwind CSS、Firebase Web SDK、lucide-react。
- 前端主要功能：图片上传、预览、诊断请求、结果页展示、历史记录读取、Firebase 登录注册、Google 登录、邮箱验证。
- 历史记录页支持用户删除本人诊断记录：前端二次确认后调用 `DELETE /api/diagnoses/[id]`，服务端用 Firebase Admin 验证 ID token、校验 Firestore document `userId` 后删除，并记录删除开始、成功、失败日志。
- 历史记录页支持批量操作：用户可进入批量选择模式、全选/单选记录、调用 `POST /api/diagnoses/batch-delete` 批量删除本人诊断记录，或将选中记录渲染为 PNG 并用 JSZip 打包下载 ZIP。
- 后端服务：`inference_service` 使用 FastAPI，负责接收图片、做人脸检测/裁剪、加载 PyTorch 模型、执行四季分类推理并返回结果。
- 当前正式模型推理流程：上传图片 -> Next.js `/api/diagnose` 校验用户和图片 -> FastAPI `/diagnose` -> 人脸检测和 face crop -> EfficientNet-B0 四分类模型 -> 后端返回 `source="model"` -> 前端二次校验 -> 生成 AI 建议 -> 写入 Firestore -> 跳转结果页。
- Firebase 使用情况：Firebase Auth 管理登录；Cloud Firestore 保存 `diagnoses/{diagnosisId}`；Next.js 服务端通过 Firebase Admin SDK 写入诊断结果。
- 当前验证情况：`npm run lint` 已通过；`npm run build` 已通过；后端 `main.py` / `face_detector.py` AST 语法检查通过；真实端到端部署验证仍需人工执行。

## 已完成的重要修改

- 图片上传和诊断流程已接入 Next.js `/api/diagnose`。
- 后端模型推理已接入 `inference_service/model_inference.py`，当前权重路径为 `inference_service/models/best_model.pth`。
- 后端人脸检测逻辑已接入 `inference_service/face_detector.py`。
- 无清晰人脸、多人脸、低置信度、无效 crop、脸太小等情况会返回 `422 NO_CLEAR_FACE`。
- 前端遇到 `NO_CLEAR_FACE` 时会中断诊断、不生成 AI 建议、不写 Firestore、不跳转结果页，并清空已选择图片和图片预览。
- 正常诊断时保存 `faceDetected`、`usedOriginalImage`、`faceConfidence`、`scores`、`source` 等字段。
- 2026-05-28 完成 P0 安全修复：FastAPI `/diagnose` 禁用 rules fallback；模型异常返回 `503 MODEL_UNAVAILABLE`；前端强制拦截非 `source="model"`；Firestore 写入前再次校验 `source === "model"`。
- `src/lib/firebase-admin.ts` 已增强环境变量检查和初始化失败日志，不泄露 private key。
- `UploadZone` 支持展示 `MODEL_UNAVAILABLE`，并在提交中禁用换图和拖拽。
- `inference_service/models/model_config_facecrop.json` 已增加生产策略说明：`strict_face_only`，线上不允许 fallback 原图。
- 已生成 Kaggle v3 训练 notebook：`colorsense_v3_kaggle_training.ipynb`。
- 2026-05-28 已基于 v3A/v3B 初步实验结果修改 `colorsense-v3-kaggle-training-notebook.ipynb`：默认主路线改为 `face_crop`，关闭 lightweight `skin_mask` 默认实验，新增数据质量诊断、每类 face crop 可视化、WeightedRandomSampler、Focal Loss、winter 专项错分分析、balanced_score 模型选择和新的 face crop quick experiments。
- 2026-05-28 新增历史诊断删除功能：`src/app/history/page.tsx` 改为通过服务端删除接口删除记录；`src/app/api/diagnoses/[id]/route.ts` 新增 DELETE，删除前读取 Firestore document 并确认归属当前用户。当前诊断记录不保存上传图片或子集合，因此删除范围仅为 `diagnoses/{diagnosisId}` document。
- 2026-05-28 验证：新增历史删除功能后 `npm run lint` 通过，`npm run build` 通过。
- 2026-05-28 新增历史记录批量操作：`src/app/history/page.tsx` 支持批量选择、批量删除、批量导出 PNG ZIP；新增 `src/app/api/diagnoses/batch-delete/route.ts`，服务端逐条校验 document 存在和 `userId` 归属后分批 batch delete；新增依赖 `jszip`。验证：`npm run lint` 通过，`npm run build` 通过。
- 2026-05-28 已将当前版本推送到 GitHub `main` 分支，最新提交为 `22004d0 Add batch history operations`。推送前已检查 staged 文件名和新增行敏感信息模式，未提交 `.env.local`、service account JSON、真实 API key、构建产物、notebook 或训练输出。

## 当前模型情况

- 当前模型为四分类：`spring` / `summer` / `autumn` / `winter`。
- 当前线上模型架构：EfficientNet-B0。
- 当前推理输入：严格 face crop，不允许原图 fallback。
- 当前训练产物显示 `test_accuracy` 约 0.589，`test_macro_f1` 约 0.589。
- 历史训练元数据中记录过 `crop_failed_policy: fallback_original`，但生产逻辑已改为 `strict_face_only`。
- 已知偏差：欧美人脸较多；亚洲人测试时容易集中预测为 `winter` 或 `summer`；`autumn` 较少出现；模型可能受人种、光照、相机白平衡、肤色分布、类别分布、背景和头发颜色影响。
- 后续需要 v3 重新训练：剔除检测失败样本，对比 face crop、skin mask、颜色统计特征融合、多 backbone、多模型融合和置信度校准。
- v3 notebook 下一轮训练目标已调整为优先解决 `winter` 类别塌缩：使用 face crop + weighted sampler + CE/Focal Loss 对比，默认实验包括 `v3A_resnet18_facecrop_weighted_ce`、`v3A_resnet18_facecrop_focal`、`v3A_effb0_facecrop_focal`、`v3A_convnext_tiny_facecrop_focal`；skin mask、dual branch、color features、ensemble 保留但默认不运行。

## 当前已知问题和风险

- 模型泛化能力不足，尤其是亚洲人和 `autumn` 类别。
- 当前模型指标不足以支撑严肃生产级诊断，只适合作为 MVP / demo / 课程项目模型。
- Render 免费或低配实例可能无法稳定加载 `torch`、`torchvision`、`mediapipe` 和模型权重。
- 后端冷启动可能导致前端 60 秒超时。
- CORS 依赖 Render 环境变量 `FRONTEND_ORIGIN`；前端部署依赖 `NEXT_PUBLIC_API_BASE_URL`。
- Firebase Admin 依赖 `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`，private key 需要兼容 `\n` 换行。
- Firestore rules 必须发布到生产项目。
- 模型权重当前在仓库目录中，未来需明确是否继续放 Git、改用 Git LFS、云存储或构建产物下载。
- 前端仍需继续检查 loading 超时、请求重试、移动端布局、结果置信度解释、上传引导和错误文案。

## 上线前待办

### P0：上线前必须解决

- [x] 后端模型失败时不能 fallback rules 并返回成功。
- [x] 前端必须拦截非 `source === "model"` 的结果。
- [x] 非模型结果不能生成 AI 建议、不能写 Firestore。
- [x] 无清晰人脸必须返回 `422 NO_CLEAR_FACE`，不能进入模型推理。
- [x] Firestore 写入前必须再次确认 `source === "model"`。
- [ ] 人工验证后端 `/health` 正常。
- [ ] 人工验证正脸图片上传成功，返回 `source="model"` 并写入 Firestore。
- [ ] 人工验证无人脸图片返回 `422 NO_CLEAR_FACE`，不写 Firestore。
- [ ] 人工验证模型文件临时缺失时返回 `503 MODEL_UNAVAILABLE`，不 fallback rules，不写 Firestore。
- [ ] 人工验证模拟后端返回 `source="rules"` 时，前端中断并返回 503。

### P1：上线前强烈建议解决

- [ ] 用 v3 notebook 重新训练 strict face crop / skin mask 模型，优先按 `val_macro_f1` 选模型。
- [ ] 针对亚洲人测试集、`autumn` recall、`winter/summer` 过预测做专项评估。
- [ ] 前端展示四类概率或 top-k，而不是只展示单一结果。
- [ ] 增加低置信度提示。
- [ ] 部署前实测 Render 内存、冷启动、首个诊断耗时。
- [ ] 修正所有历史乱码文案和过时 fallback 文案。
- [ ] 检查 Firestore rules 是否已发布到正确 Firebase 项目。

### P2：上线后可优化

- [ ] loading 超时提示、重试机制、后端冷启动说明。
- [ ] 多人脸、侧脸、脸太小、遮挡、暗光等错误原因细分提示。
- [ ] 历史记录筛选、删除确认、结果分享体验优化。
- [ ] 移动端 UI 细节、按钮状态、防重复提交细节继续打磨。
- [ ] 增加后端请求日志、推理耗时、模型加载状态日志。
- [ ] 增加健康检查中模型可用状态，例如 `/health?check_model=1`。

### P3：长期产品和模型优化方向

- [ ] 建立更均衡的数据集，补充亚洲人脸、多肤色、多光照、多年龄样本。
- [ ] 训练 v3A face crop 多模型、v3B skin mask、多 backbone 对比。
- [ ] 实验 v3D CNN + 颜色统计特征融合。
- [ ] 实验 v3E 多模型 soft voting ensemble。
- [ ] 引入更强的人脸解析或 skin mask：FaRL、RetinaFace、MediaPipe Face Mesh、MTCNN 等。
- [ ] 做置信度校准，例如 temperature scaling / ECE。
- [ ] 模型部署优化：ONNX Runtime、TorchScript、量化、小模型替代。
- [ ] 产品层面增加结果解释、用户反馈、错分样本回收和人工标注闭环。

## 后续开发注意事项

- 任何无人脸、低质量人脸、检测异常、多人脸、无效 face crop 的图片都不能进入模型推理。
- 后端正式 `/diagnose` 不能 fallback 到 rules 并保存错误结果。
- `/diagnose-lab` 只能作为开发调试接口，不代表正式图片诊断能力。
- 前端不能在错误响应时生成 AI 建议、生成结果页或写入历史记录。
- 模型预测失败时应返回明确错误，例如 `503 MODEL_UNAVAILABLE`，不能静默使用默认结果。
- 训练预处理和线上推理预处理必须保持一致。
- 后续修改接口字段时，需要同步更新 FastAPI response、Next.js `/api/diagnose`、`src/lib/types.ts`、`UploadZone`、结果页、Firestore 保存字段和训练 metadata。
- 不要重新启用 Supabase、Resend、SMTP、自建验证码等旧路线，除非明确重新设计。
- 不要提交 `.env.local`、service account JSON 或任何 private key。
- 删除或移动文件必须遵守项目安全规则：先说明路径和原因，等待用户确认。

## 下一步建议

1. 执行真实端到端 P0 验证：正脸成功、无人脸 422、模型缺失 503、模拟 `source="rules"` 503、Firestore 只在成功模型诊断后新增记录。
2. 修复所有页面和文档中的乱码中文文案。
3. 在 Kaggle 运行 `colorsense_v3_kaggle_training.ipynb`，优先得到 strict face crop v3A baseline。
4. 部署前实测 Render 或替代平台内存和冷启动。
5. 根据 v3 实验结果决定下一版主模型和是否上线 skin mask / color fusion。

---

# Historical Memory Below

# ColorSense Development Memory

## 1. 项目基本信息

- 项目名称：ColorSense
- 项目定位：面向中文用户的 AI 四季色彩诊断 Web App
- 前端技术栈：Next.js 14 + TypeScript + Tailwind CSS
- AI 推理服务：FastAPI
- 当前开发目标：完成注册登录、上传诊断、结果展示、历史记录、结果下载的 MVP 流程

## 2. 当前最终技术路线

### 认证

- 认证系统：Firebase Authentication
- 支持邮箱 + 密码注册
- 注册后由 Firebase 自动发送邮箱验证邮件
- 支持邮箱 + 密码登录
- 邮箱密码用户未完成邮箱验证时，不允许进入受保护功能
- 支持 Google OAuth 登录
- 支持退出登录和登录状态保持
- 当前代码由 `AuthProvider` / `useAuth` 维护认证状态，`ProtectedRoute` 保护业务页面

### 数据库

- 数据库：Cloud Firestore
- 用途：保存用户诊断历史和诊断结果
- 当前诊断记录由登录用户在前端写入 Firestore，Firestore Security Rules 负责限制只能访问本人数据

### AI 推理

- 继续保留 FastAPI 推理服务
- Next.js 的 `/api/diagnose` 接收图片并调用 FastAPI
- 当前 FastAPI 使用现有 `face_detector` 与 `season_classifier` 流程，返回 `season`、`confidence`、`lab_features` 等推理结果
- Next.js 结合 `src/lib/seasons.ts` 生成完整的色卡、关键词、避免色和基础风格建议
- 前端将完整诊断结果写入 Firestore
- FastAPI 不可用或未配置时，当前 API 保留 mock fallback，并在数据中以 `source: "mock"` 标记
- 计划在 Kaggle 上使用 Deep-Armocromia 数据集，以 EfficientNet-B0 进行春、夏、秋、冬四分类迁移学习训练
- 训练完成后将导出的模型下载到本地，并接入本地 FastAPI 推理服务供 Next.js 调用；该模型接入尚未实现

### 图片与结果导出

- V1 不强制使用云端图片存储
- 上传图片只用于当前诊断请求和浏览器本地预览
- 历史记录只保存必要诊断结果数据，不保存原图
- 结果导出为用户本地下载
- 当前使用 `html2canvas` 下载 PNG 结果卡片
- 不发送结果邮件

## 3. 已完成内容

- 新增 `src/lib/firebase.ts`，初始化 Firebase App，并提供 Auth 与 Firestore 实例。
- 新增 `src/components/AuthProvider.tsx` 与 `src/lib/useAuth.ts`，维护 `currentUser`、`loading`、`isAuthenticated`、`logout`。
- 新增 `src/components/ProtectedRoute.tsx`，保护 `/upload`、`/processing`、`/result`、`/history`。
- 登录页已改为 Firebase 邮箱注册、邮箱验证、邮箱登录和 Google 登录流程；验证邮件使用 `/login?verified=1` 回跳，保留同浏览器 session 时可在验证完成后自动进入 `/upload`。
- 导航栏已切换为 Firebase 退出登录。
- 新增 `src/lib/firestore-diagnoses.ts`，实现诊断记录写入、查询、详情读取和删除。
- `/api/diagnose` 已停止写入 Supabase/上传云端图片，只负责 FastAPI 推理或 mock fallback。
- 上传页会将诊断结果写入当前用户的 Firestore 记录后跳转结果页。
- 结果页已从 Firestore 加载当前用户记录，显示季型、置信度、推荐色卡、避免色、风格建议和生成时间。
- 结果页保留并使用 PNG 本地下载功能。
- 历史页已从 Firestore 查询当前用户记录，并支持查看详情和删除本人记录。
- 新增 `firestore.rules`，限制已验证邮箱用户或 Google 登录用户只能操作自己的 `diagnoses` 文档。
- `.env.example` 和 `README.md` 已更新为 Firebase/Firestore 技术路线。
- 最近验证结果：`npm run lint` 通过、`npm run build` 通过、开发服务器可启动并响应 `/login` 与 `/upload`。

## 4. 已废弃或停止使用的方案

以下方案不再作为当前主流程使用：

- Supabase Auth
- Supabase 数据库与 Supabase Storage
- Resend 邮箱验证码
- SMTP 邮件发送
- 手机号验证
- 自建 6 位邮箱验证码注册流程
- 购买域名作为注册邮件发送的必要条件

原因：

- Supabase 连接在当前开发过程中不够稳定。
- Resend 在不购买或验证域名时无法稳定向任意用户发送验证码。
- 手机号验证通常不是免费且稳定的大作业 MVP 方案。
- Firebase Auth 可直接支持邮箱验证邮件与 Google 登录，更适合当前 MVP。

代码状态说明：

- 旧 Supabase、Resend、SMTP 和验证码相关文件为避免删除风险而保留，并已标记或视为 deprecated。
- 相关旧依赖目前也可能仍保留在 `package.json` 中，属于待清理遗留内容，不代表当前主流程仍在使用。
- 旧 `/api/auth/*`、`/api/email-result` 和 `/api/diagnoses/*` 接口不再执行旧功能，只返回废弃提示。
- 不要在新开发中重新连接这些旧方案。

## 5. Firebase 需要配置的内容

Firebase Console 中需要完成：

1. 创建 Firebase 项目。
2. 添加 Web App，并复制 Web 配置。
3. 开启 Authentication。
4. 开启 `Email/Password` 登录。
5. 关闭 Email link 无密码登录，不使用该流程。
6. 开启 Google 登录。
7. 创建 Cloud Firestore 数据库。
8. 将项目根目录 `firestore.rules` 发布为 Firestore Security Rules。

`.env.local` 需要填写：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000

INFERENCE_SERVICE_URL=http://localhost:8000
```

不要提交 `.env.local`。

Firebase 邮箱验证流程使用 `NEXT_PUBLIC_APP_URL` 生成验证完成后的回跳地址：

```text
${NEXT_PUBLIC_APP_URL}/login?verified=1
```

本地开发时需在 Firebase Authentication 的 Authorized domains 中允许 `localhost`。

## 6. Firestore 数据结构

- Collection：`diagnoses`
- Document 路径：`diagnoses/{diagnosisId}`

字段：

```text
id
userId
createdAt
seasonType
confidence
labFeatures
aiDescription
colorPalette
styleKeywords
avoidColors
source
scores
```

访问约束：

- 历史记录页只查询当前 `userId` 的数据。
- 结果页根据 `diagnosisId` 读取单条数据，并验证归属当前用户。
- 删除记录时只能删除当前用户自己的记录。
- Firestore rules 要求邮箱用户已验证，或使用 Google provider 登录。

## 7. 主要功能状态

### Firebase 初始化

- 文件：`src/lib/firebase.ts`
- 状态：已实现，导出 `auth` 和 `db`；未填 Firebase 配置时不会在构建期间抛错。

### 认证页面

- 页面：`/login`，兼容入口 `/auth` 和 `/register` 会跳转到登录页。
- 状态：已实现邮箱注册、Firebase 验证邮件、`/login?verified=1` 验证回跳状态检查、邮箱登录、Google 登录、中文错误提示和 loading 状态。
- 规则：邮箱登录用户必须验证邮箱后才能进入上传与诊断流程。
- 回跳行为：同浏览器仍有 Firebase session 且验证状态刷新成功时自动进入 `/upload`；没有 session 时提示用户使用邮箱和密码登录。

### 登录状态管理

- 文件：`src/components/AuthProvider.tsx`、`src/lib/useAuth.ts`
- 状态：已实现 `currentUser`、`loading`、`isAuthenticated`、`logout`。

### 路由保护

- 文件：`src/components/ProtectedRoute.tsx`
- 页面：`/upload`、`/processing`、`/result`、`/history`
- 状态：已实现客户端保护；未登录或邮箱未验证用户被转到 `/login`，Google 用户直接放行。

### 诊断流程

- 用户上传图片后调用 `/api/diagnose`。
- Next.js 调用 FastAPI；失败时可使用 mock fallback。
- 返回结果结合 `seasons.ts` 组成完整诊断数据。
- `UploadZone` 将数据写入 Firestore，随后跳转 `/result/[id]`。

### 结果页

- 状态：已改为从 Firestore 读取本人诊断结果。
- 展示：季型、置信度、推荐色卡、避免色、风格建议、生成时间。
- 下载：`html2canvas` 生成 PNG，仅保存到本地，不发送邮件。

### 历史页

- 状态：已改为从 Firestore 查询当前用户诊断记录。
- 展示：诊断时间、季型、置信度、色卡缩略图。
- 支持进入详情页和删除本人记录。

## 8. 后端模型训练与接入计划

当前状态：

- FastAPI 服务已存在，并可被 Next.js `/api/diagnose` 调用。
- 仓库当前尚未包含 Deep-Armocromia 数据集训练 notebook、EfficientNet-B0 训练产物或对应模型加载逻辑。

计划路线：

1. 在 Kaggle Notebook 环境获取并整理 Deep-Armocromia 数据集。
2. 使用 EfficientNet-B0 作为预训练骨干网络，进行 `spring`、`summer`、`autumn`、`winter` 四分类迁移学习训练。
3. 在 Kaggle 中完成训练集/验证集评估、权重保存与可复现实验记录。
4. 导出训练完成的模型文件并下载到本地项目的推理服务部署位置。
5. 修改 FastAPI 推理逻辑加载导出模型，以图片输入返回四季分类结果与置信度。
6. 通过 Next.js `/api/diagnose` 联调真实模型推理，并在保留 fallback 策略的前提下验证前端结果展示。

## 9. 下次 CLI 启动时的工作方式

- 每次开始工作前，先读取项目根目录的 `MEMORY.md` 和 `README.md`。
- 以 Firebase Auth + Firestore + FastAPI + 本地 PNG 下载作为唯一当前技术路线。
- 不要重新使用 Supabase、Resend、SMTP 或手机号验证。
- 将 Deep-Armocromia + EfficientNet-B0 视为待实施的模型训练方案，在训练产物实际接入 FastAPI 前不要写成已完成能力。
- 如果发现代码与 `MEMORY.md` 不一致，先指出差异，再询问是否需要按 `MEMORY.md` 修正。
- 当前工作区可能包含尚未提交的技术路线改造文件；不要回退用户已有修改。

## 10. 当前下一步任务

Firebase 和 Firestore 主流程代码已经完成替换，下一步应优先进行真实 Firebase 联调：

1. 用户在 Firebase Console 完成 Authentication、Google Provider、Firestore 与 Security Rules 配置。
2. 用户在 `.env.local` 填入真实 Firebase Web App 配置及 `NEXT_PUBLIC_APP_URL`，并重启开发服务器。
3. 实测邮箱注册、Firebase 验证链接回到 `/login?verified=1`、同浏览器自动进入 `/upload` 和无 session 时手动登录分支。
4. 实测上传诊断、FastAPI 可用与 mock fallback 两种路径、结果下载、历史查看和删除。
5. 在 Kaggle 上基于 Deep-Armocromia 数据集训练 EfficientNet-B0 四分类模型，并将导出模型接入本地 FastAPI 服务。
6. 联调稳定后，评估是否在用户明确授权后移动 deprecated 的 Supabase/Resend/SMTP 文件到回收目录，并从依赖中彻底清理旧包。
7. 如需要服务端级别的路由/API 强校验，再引入 Firebase Admin session 或 ID token 验证；当前 MVP 通过客户端路由保护和 Firestore Security Rules 保障数据访问。
