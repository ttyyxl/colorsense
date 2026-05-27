# ColorSense 本地运行指南

本文档适用于在 Windows PowerShell 中从零启动 ColorSense。本项目由两个本地服务组成：

- Next.js 前端及 API 路由：`http://localhost:3000`
- FastAPI 模型推理服务：`http://localhost:8000`

上传诊断的主要调用链如下：

```text
浏览器登录 Firebase
  -> 上传页面携带 Firebase ID token 请求 POST /api/diagnose
  -> Next.js API 使用 Firebase Admin 验证 token
  -> Next.js API 调用 FastAPI POST /diagnose
  -> EfficientNet-B0 模型推理，失败时使用规则分类
  -> Next.js API 将诊断结果写入 Firestore 并返回 diagnosisId
  -> 前端根据 diagnosisId 跳转结果页
```

## 1. 拉取代码

在 PowerShell 中执行：

```powershell
git clone https://github.com/ttyyxl/-.git colorsense
cd colorsense
git checkout main
git pull origin main
```

确认当前位于最新 `main` 分支：

```powershell
git branch --show-current
git log -1 --oneline
```

## 2. 前端环境准备

### Node.js 版本

建议使用 Node.js 22 LTS 或更新的 LTS 版本。检查版本：

```powershell
node -v
npm -v
```

### 安装依赖

仓库已包含 `package-lock.json`，首次安装或需要严格复现依赖时优先使用：

```powershell
npm ci
```

如果正在本地维护依赖、需要更新 lockfile，再使用：

```powershell
npm install
```

确认前端依赖可正常编译：

```powershell
npm run lint
npm run build
```

## 3. FastAPI 推理服务环境准备

推荐使用 Python 3.10 或 3.11。检查 Python 与 pip：

```powershell
python --version
python -m pip --version
```

进入推理服务目录并创建虚拟环境：

```powershell
cd inference_service
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

如果 PowerShell 阻止激活脚本，可仅在当前终端临时放开限制：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

当前项目依赖 `mediapipe==0.10.35`。诊断仅接受清晰、单人、真人正脸，人脸候选置信度必须达到 `MIN_FACE_CONFIDENCE = 0.80`，且人脸框尺寸和眼睛/鼻子/嘴部关键点几何关系必须有效。未检测到有效人脸区域、候选置信度不足、质量校验失败或人脸检测不可用时，后端会返回 `422 NO_CLEAR_FACE` 并中断诊断；不得使用原始 RGB 图片继续进行季型推理。

确认模型文件存在：

```powershell
Get-Item .\models\best_model.pth
Get-Item .\models\label_map.json
```

### 启动 FastAPI

保持当前目录为 `inference_service`：

```powershell
uvicorn main:app --reload --port 8000
```

另开一个 PowerShell 终端测试健康检查：

```powershell
Invoke-RestMethod "http://localhost:8000/health"
```

预期结果：

```json
{"status":"ok"}
```

也可以直接上传本地测试图片验证模型服务：

```powershell
curl.exe -X POST "http://localhost:8000/diagnose" -F "image=@C:\path\to\face.jpg;type=image/jpeg"
```

模型成功时返回数据中应包含：

```json
{
  "source": "model",
  "season": "...",
  "confidence": 0.0,
  "scores": {}
}
```

若返回 `"source": "rules"`，说明请求成功，但真实模型加载或推理失败，后端使用了规则 fallback；此时检查 FastAPI 终端 warning 日志和模型文件。

若上传图片没有清晰人脸，应返回 `422`，且响应包含：

```json
{
  "error": "NO_CLEAR_FACE",
  "message": "未检测到清晰人脸，请在自然光下上传正面人像照片后重试。",
  "quality": {
    "faceDetected": false,
    "usedOriginalImage": true,
    "faceConfidence": 0.0
  }
}
```

此时 FastAPI 日志不应出现 `Model prediction predicted_idx=...`。

例如动物图片若产生 `face_confidence=0.592` 的 face-like 候选，由于低于 `0.80` 阈值，也必须返回 `422 NO_CLEAR_FACE`，日志应出现：

```text
[diagnose] Face confidence too low; aborting diagnosis.
[diagnose] Returning 422 NO_CLEAR_FACE.
```

## 4. Firebase 前端配置

在项目根目录创建 `.env.local`：

```powershell
cd ..
notepad .env.local
```

填写以下前端 Firebase Web App 配置：

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

这些值从 Firebase Console 获取：

```text
Project settings -> General -> Your apps -> Web app -> Firebase SDK snippet / Config
```

同时确认 Firebase Console 中已完成：

- 已启用项目使用的 Authentication 登录方式。
- 开发环境使用的 `localhost` 已允许用于认证。
- Firestore 数据库已经创建，并配置了适合当前登录用户写入/读取 `diagnoses` collection 的规则。

## 5. Firebase Admin 服务端配置

`/api/diagnose` 是受保护的 Next.js API 路由。浏览器登录后发送 Firebase ID token，服务端使用 Firebase Admin SDK 校验该 token。因此 `.env.local` 还必须包含：

```dotenv
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

获取方式：

```text
Firebase Console
  -> Project settings
  -> Service accounts
  -> Generate new private key
```

下载的 service account JSON 字段对应关系：

| `.env.local` 变量 | JSON 字段 |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` |

配置要求：

- `FIREBASE_PROJECT_ID` 必须与 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 完全一致。
- Service account JSON 必须来自前端 Firebase Web App 使用的同一个项目。
- `FIREBASE_PRIVATE_KEY` 在 `.env.local` 中保留 `\n` 转义格式；应用启动时会转换为真实换行。
- 不得将 `.env.local` 或下载的 service account JSON 提交到 Git。

## 6. 需要代理时的网络配置

Firebase Admin 校验 ID token 时需要获取 Google 公钥。如果本地网络需要代理，必须在启动 Next.js 的同一个 PowerShell 窗口中，先设置代理环境变量，再执行 `npm run dev`。

例如代理端口为 `7890`：

```powershell
cd "D:\path\to\colorsense"
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
npm run dev
```

验证当前终端能访问 Google 公钥地址：

```powershell
Invoke-WebRequest "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com" -UseBasicParsing
```

注意：

- 必须先设置代理，再启动 `npm run dev`。
- 已经运行的 Node.js 进程不会自动继承后来添加的环境变量。
- 修改 `.env.local` 或代理设置后，需要停止并重新启动 Next.js。
- 当前代码会将 `HTTP_PROXY` / `HTTPS_PROXY` 配置为 Firebase Admin 使用的代理 agent。

## 7. 完整启动顺序

### 终端 1：启动 FastAPI

```powershell
cd "D:\path\to\colorsense\inference_service"
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

检查：

```powershell
Invoke-RestMethod "http://localhost:8000/health"
```

预期：`status` 为 `ok`。

### 终端 2：启动 Next.js

```powershell
cd "D:\path\to\colorsense"
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
npm run dev
```

如果网络环境无需代理，可以跳过两行代理设置命令。

预期终端提示可访问：

```text
http://localhost:3000
```

## 8. 浏览器测试流程

1. 打开登录页：

   ```text
   http://localhost:3000/login
   ```

2. 使用 Firebase Authentication 中可用的用户完成登录。

3. 打开上传页：

   ```text
   http://localhost:3000/upload
   ```

4. 打开 Chrome DevTools，切换到 `Network` 标签页。

5. 上传一张人脸图片并点击诊断。

6. 在 Network 中检查 `POST /api/diagnose`：

   - Request Headers 中应有 `Authorization: Bearer eyJ...`。
   - Response Status 应为 `200`。
   - Response 数据中的 `source` 通常应为 `"model"`。

7. 查看 FastAPI 终端：

   - 应出现 `POST /diagnose HTTP/1.1" 200`。
   - 对清晰人脸，日志应显示 `faceDetected=True`、`usedOriginalImage=False` 并进入模型推理。
   - 如果没有检测到清晰人脸、候选低于 `0.80`、人脸几何校验失败或 MediaPipe 不可用，接口应返回 `422 NO_CLEAR_FACE`，不应出现模型预测日志。

8. 检查页面行为：

   - 保存成功后应跳转到 `/result/{diagnosisId}`，或展示对应分析结果。
   - 刷新结果页后仍能读取该记录。
   - 历史记录页应可看到当前登录用户保存的诊断记录。
   - 无清晰真人正脸时应停留上传页并提示重新上传，不应创建 Firestore 诊断记录；动物、玩偶、卡通、风景、物体和多人合照均按此处理。

## 9. Firestore 与登录状态确认

### 浏览器侧

上传诊断请求成功前，应满足：

- 用户已经登录，前端 `auth.currentUser` 不为空。
- `/api/diagnose` 请求携带 Firebase ID token。
- API 仅在服务端成功写入 Firestore collection `diagnoses` 后返回 `200`。
- API 返回的 `diagnosisId` 来自 Firestore 文档 ID，前端使用它跳转 `/result/{diagnosisId}`。

### Firebase Console 侧

在 Firebase Console 中打开 Firestore Data，检查：

```text
diagnoses / {newDocumentId}
```

新建记录应与刚刚的上传操作对应，包含诊断季型、置信度、来源和用户标识等数据字段。

### 服务端安全调试日志

在开发环境中，Next.js 终端会输出不含凭据内容的调试信息，例如：

```text
[auth-debug] {
  authorizationHeaderPresent: true,
  tokenPresent: true,
  tokenLength: ...,
  firebaseProjectIdPresent: true,
  firebaseClientEmailPresent: true,
  firebasePrivateKeyPresent: true,
  httpProxyPresent: true,
  httpsProxyPresent: true,
  firebaseAdminInitialized: ...
}
```

日志不会输出完整 token 或 private key。若 `verifyIdToken` 失败，会输出错误 `code` 和 `message` 以便定位。

## 10. 可在命令行完成的测试

以下测试不要求浏览器登录：

```powershell
# 前端静态检查与构建
npm run lint
npm run build

# FastAPI 健康检查
Invoke-RestMethod "http://localhost:8000/health"

# FastAPI 直接模型诊断，不经过 Next.js 登录保护
curl.exe -X POST "http://localhost:8000/diagnose" -F "image=@C:\path\to\face.jpg;type=image/jpeg"

# FastAPI 无清晰人脸校验，应返回 422 NO_CLEAR_FACE 且不记录模型预测日志
curl.exe -X POST "http://localhost:8000/diagnose" -F "image=@C:\path\to\no-face.png;type=image/png"

# 动物或 face-like 低置信度候选校验，例如 face_confidence=0.592，应返回 422 NO_CLEAR_FACE
curl.exe -X POST "http://localhost:8000/diagnose" -F "image=@C:\path\to\animal.jpg;type=image/jpeg"

# 代理连通 Google 公钥服务
Invoke-WebRequest "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com" -UseBasicParsing
```

以下验证必须在浏览器真实登录后完成：

- `/api/diagnose` 的 Firebase ID token 校验。
- 上传页面完整工作流。
- Firestore 对当前登录用户的实际写入权限。
- 结果页和历史记录页基于用户数据的读取展示。

## 11. 常见问题排查

| 现象或错误 | 常见原因 | 优先检查与处理 |
| --- | --- | --- |
| `Firebase Admin service account configuration is missing` | `.env.local` 缺少 Admin 三项变量 | 补全 `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`，重启 `npm run dev` |
| `Unable to detect a Project Id in the current environment` | 使用了旧代码或未配置显式 Admin 凭据 | 确认已拉取最新 `main`，并填写 service account 三项配置 |
| `Error while making request` | Node 进程无法访问 Google 公钥地址 | 在启动 `npm run dev` 前设置 `HTTP_PROXY` / `HTTPS_PROXY`，验证公钥 URL 可访问 |
| `incorrect aud claim` | 前端项目与 Admin service account 不一致 | 对比 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 与 `FIREBASE_PROJECT_ID`，更换为同一项目凭据 |
| 日志中 `httpProxyPresent` / `httpsProxyPresent` 为 `false` | 代理变量未在 Next.js 进程启动前设置 | 停止 Next.js，在同一 PowerShell 设置代理后重新启动 |
| `POST /api/diagnose 401` | 未携带 token，token 验证失败，或 Admin 配置/网络异常 | 检查 Network Authorization 头和 Next.js `[auth-debug]` 日志 |
| `POST /api/diagnose 200` 但页面一直正在诊断 | Firestore 写入失败、规则拒绝或结果跳转失败 | 查看浏览器 Console、Firestore permissions、是否写入 `diagnoses` 文档 |
| `permission-denied` | Firestore rules 不允许当前用户写/读 | 在 Firebase Console 检查规则是否允许已登录用户访问对应数据 |
| `Failed to download Inter from Google Fonts` | 开发环境无法访问字体服务 | 检查网络/代理；该错误与模型推理或 token 校验分开定位 |
| `mediapipe==...` 安装失败 | Python 或 pip 环境不兼容，或未使用最新 requirements | 确认代码为最新 `main`，使用 Python 3.10/3.11，升级 pip 后安装 `mediapipe==0.10.35` |
| FastAPI `/health` 无法访问 | 服务未启动、虚拟环境未激活或端口被占用 | 查看 FastAPI 启动日志，确认端口 `8000` 可用 |
| `/diagnose` 返回 `422 NO_CLEAR_FACE` | 图片没有清晰正脸、人脸 crop 无效或检测组件不可用 | 使用自然光下清晰正脸照重试；该请求不会生成季型结果或写入诊断记录 |
| 动物/卡通/物体图片被识别为 face-like 候选 | 检测器找到低置信度相似区域 | 确认日志显示低于 `MIN_FACE_CONFIDENCE = 0.80` 后返回 `422 NO_CLEAR_FACE`，且无模型预测日志 |
| `/diagnose` 返回 `source: "rules"` | 模型加载/推理异常触发 fallback | 检查模型文件路径、torch/torchvision 安装以及 FastAPI warning 日志 |

## 12. 本地运行成功标准

完成下列检查即可判定项目本地运行成功：

- `npm run dev` 可正常启动 Next.js。
- FastAPI 已启动，`GET /health` 返回 `{"status":"ok"}`。
- 浏览器能够完成 Firebase 登录。
- 上传清晰正脸时，上传页发出的 `POST /api/diagnose` 携带 `Authorization: Bearer ...` 并返回 `200`。
- 上传清晰真人正脸且 `faceConfidence >= 0.80` 时，FastAPI 收到 `POST /diagnose` 并返回 `200`，响应通常包含 `source: "model"`、`faceDetected: true` 和 `usedOriginalImage: false`。
- 上传清晰正脸时，Firestore 中新增对应诊断记录，页面可进入 `/result/{diagnosisId}` 并展示结果，历史记录页可以读取保存的数据。
- 上传无人脸或无清晰人脸图片时，FastAPI 和 Next.js API 返回 `422 NO_CLEAR_FACE`，上传页停留并提示重新上传，Firestore 不新增诊断记录。
- 上传动物、玩偶、卡通、风景、物体、多人合照或低质量/遮挡/逆光照片时，如未通过真人正脸质量守卫，同样返回 `422 NO_CLEAR_FACE`，不进入季型模型推理。
