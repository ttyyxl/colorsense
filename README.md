# ColorSense

ColorSense 是基于 Next.js 的 AI 四季色彩诊断 Web App。

## 技术路线

- 前端：Next.js 14、TypeScript、Tailwind CSS
- 认证：Firebase Authentication，支持邮箱密码注册、邮箱验证、邮箱登录、Google 登录和退出
- 数据：Cloud Firestore，保存当前用户的诊断结果与历史记录
- 推理：FastAPI 服务；不可用时前端 API 使用 mock fallback 以便本地调试
- 导出：结果页使用 `html2canvas` 下载 PNG，不发送邮件

旧 Supabase、Resend、SMTP 和六位验证码文件仅作为迁移参考保留，当前页面和诊断流程不再调用这些服务。

## 环境变量

在项目根目录创建 `.env.local`，填写 Firebase Web App 配置：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

INFERENCE_SERVICE_URL=http://localhost:8000
```

不要提交 `.env.local`。

## Firebase 配置

1. 在 Firebase Console 创建项目，并添加 Web App。
2. 将 Web App 的 `firebaseConfig` 六项写入 `.env.local`。
3. 打开 `Authentication -> Sign-in method`，启用 `Email/Password`。
4. 在同一页面启用 `Google`，配置项目支持邮箱。
5. 打开 `Firestore Database`，创建数据库。
6. 将 [firestore.rules](./firestore.rules) 内容发布为 Firestore Security Rules。

邮箱注册成功后，Firebase 自动发送验证邮件。邮箱密码用户仅在点击验证链接后才能进入受保护页面；Google 登录用户可直接进入。

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

未启动 FastAPI 或未填写 `INFERENCE_SERVICE_URL` 时，`/api/diagnose` 会返回 mock 诊断结果，并将 `source` 标记为 `mock`。

## 测试流程

1. 访问 `http://localhost:3000/login`。
2. 输入邮箱和密码点击“邮箱注册”，打开 Firebase 验证邮件并完成验证。
3. 返回登录页使用邮箱密码登录，确认跳转至 `/upload`。
4. 点击“使用 Google 登录”，确认 Google 用户也可进入 `/upload`。
5. 上传图片开始诊断，确认结果页展示季型、置信度、色卡、避免色、风格建议和生成时间。
6. 在结果页点击“下载 PNG”，确认结果卡片保存到本地。
7. 访问 `/history`，确认仅显示当前用户记录，并可删除自己的记录。
8. 退出登录后直接访问 `/upload`、`/processing`、`/result` 或 `/history`，确认跳转登录页。
