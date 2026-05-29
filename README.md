# ColorSense

ColorSense 是基于 Next.js 的 AI 四季色彩诊断 Web App。

## 技术路线

- 前端：Next.js 14、TypeScript、Tailwind CSS
- 认证：Firebase Authentication，支持邮箱密码注册、邮箱验证、邮箱登录、Google 登录和退出
- 数据：Cloud Firestore，保存当前用户的诊断结果与历史记录
- 推理：FastAPI 服务；不可用时 Next.js API 使用 mock fallback 以便本地调试
- 导出：结果页使用 `html2canvas` 下载 PNG，不发送邮件

当前主技术路线为 `Next.js + Firebase Auth + Firestore + FastAPI`。Supabase、Resend、SMTP 与自建六位邮箱验证码流程均已废弃，不作为新功能基础；相关历史文件和依赖目前可能仍在仓库中保留待清理，当前认证与诊断主流程不再调用这些服务。

## 环境变量

在项目根目录创建 `.env.local`，填写 Firebase Web App 配置：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000

# Firebase Admin，受保护的 Next.js API 路由需要
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Firebase Admin 三项配置来自同一 Firebase 项目的 Service Account JSON：在 Firebase Console 的 `Project settings -> Service accounts` 中生成私钥文件，将其中的 `project_id`、`client_email`、`private_key` 填入上述变量。`FIREBASE_PROJECT_ID` 必须与 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 指向同一个项目。不要提交 `.env.local` 或下载的私钥 JSON 文件。

## Firebase 配置

1. 在 Firebase Console 创建项目，并添加 Web App。
2. 将 Web App 的 `firebaseConfig` 六项写入 `.env.local`。
3. 打开 `Authentication -> Sign-in method`，启用 `Email/Password`。
4. 在同一页面启用 `Google`，配置项目支持邮箱。
5. 打开 `Authentication -> Settings -> Authorized domains`，本地开发时确认包含 `localhost`。
6. 打开 `Firestore Database`，创建数据库。
7. 将 [firestore.rules](./firestore.rules) 内容发布为 Firestore Security Rules。

邮箱注册成功后，客户端通过 Firebase `sendEmailVerification` 发送验证邮件，验证完成后的继续地址为 `${NEXT_PUBLIC_APP_URL}/login?verified=1`。同一浏览器仍保留 Firebase session 时，回到登录页会刷新验证状态并自动进入 `/upload`；没有 session 时，页面提示用户使用邮箱和密码登录。邮箱密码用户仅在完成验证后才能进入受保护页面；Google 登录用户可直接进入。

## Firestore 数据结构

集合为 `diagnoses/{diagnosisId}`，字段包括：

```text
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

安全规则限制已完成邮箱验证的用户或 Google 登录用户只能创建、读取和删除自己的记录。历史页按当前 `userId` 查询并在界面中按 `createdAt` 倒序展示。

## 本地运行

前端：

```bash
npm install
npm run dev
```

推理服务：

```bash
cd inference_service
python -m venv venv
pip install -r requirements.txt
uvicorn main:app --reload
```

推理服务推荐使用 Python 3.10 或 3.11。`mediapipe==0.10.35` 用于人脸裁剪。诊断仅接受清晰、单人、真人正脸：人脸候选置信度必须达到 `MIN_FACE_CONFIDENCE = 0.80`，并通过人脸框尺寸与眼睛/鼻子/嘴部关键点几何校验。如果无法检测到有效人脸区域、置信度不足、质量校验失败或人脸检测不可用，`/diagnose` 会返回 `422 NO_CLEAR_FACE`，不会使用原始图片执行季型推理，也不会生成可保存的诊断结果。

动物、玩偶、卡通、风景、物体、多人合照，以及模糊、遮挡或强逆光导致质量不足的照片均不应进入季型模型推理。若出现类似动物图片被检测为 `face_confidence=0.592` 的 face-like 候选，服务会因低于 `0.80` 阈值而拒绝该请求。

正式诊断流程必须启动 FastAPI 并配置 `NEXT_PUBLIC_API_BASE_URL`；服务不可用时 `/api/diagnose` 会返回失败，不会保存 mock 结果。仅在已取得有效人脸区域后，如真实模型加载或推理失败，FastAPI 才会使用该人脸特征进行 LAB 规则 fallback，并将 `source` 标记为 `rules`。

### Windows 本地代理

`/api/diagnose` 会在服务端通过 Firebase Admin 校验登录用户的 ID token。该校验需要访问 Google 公钥地址。如果本机网络需要代理，必须在启动 Next.js 的同一个 PowerShell 窗口中先设置代理：

```powershell
cd "D:\桌面\machine learning\大作业\colorsense"
$env:HTTP_PROXY="http://127.0.0.1:你的代理端口"
$env:HTTPS_PROXY="http://127.0.0.1:你的代理端口"
npm run dev
```

项目会将代理传给 Firebase Admin 的 HTTP agent。更改 `.env.local` 或代理环境变量后，需要停止并重新启动 `npm run dev`。

## 模型训练计划

当前仓库中的 FastAPI 推理服务仍使用现有分类流程，尚未接入训练后的深度学习模型。计划中的真实模型路线为：

1. 在 Kaggle 上使用 Deep-Armocromia 数据集。
2. 基于预训练 `EfficientNet-B0` 进行春、夏、秋、冬四分类迁移学习训练。
3. 完成验证与模型导出后，将训练模型下载到本地。
4. 将模型接入本地 FastAPI 推理服务，由 Next.js `/api/diagnose` 调用并向前端返回分类结果。

## 测试流程

1. 访问 `http://localhost:3000/login`。
2. 输入邮箱和密码点击“邮箱注册”，确认页面提示验证邮件已发送。
3. 打开 Firebase 验证邮件并完成验证，确认回到 `/login?verified=1`。
4. 在同浏览器保留 session 时确认自动跳转至 `/upload`；无 session 时确认页面提示使用邮箱和密码登录。
5. 使用未验证邮箱登录，确认无法进入 `/upload`；使用已验证邮箱登录，确认可进入。
6. 点击“使用 Google 登录”，确认 Google 用户也可进入 `/upload`。
7. 上传图片开始诊断，确认结果页展示季型、置信度、色卡、避免色、风格建议和生成时间。
8. 在结果页点击“下载 PNG”，确认结果卡片保存到本地。
9. 访问 `/history`，确认仅显示当前用户记录，并可删除自己的记录。
10. 退出登录后直接访问 `/upload`、`/processing`、`/result` 或 `/history`，确认跳转登录页。