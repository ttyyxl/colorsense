# Render Free Web Service 部署

## 配置

从仓库创建 Render Web Service，并使用以下设置：

```text
Root Directory: inference_service
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

环境变量：

```dotenv
FRONTEND_ORIGIN=https://your-vercel-project.vercel.app
```

部署完成后，将 Render 公开 URL 写入 Vercel：

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com
```

## 模型文件

推理代码从 `models/best_model.pth` 和 `models/label_map.json` 加载模型资源，路径基于 `model_inference.py` 所在目录计算，不依赖开发机器的绝对路径。

在部署前确认模型文件存在于 Render 构建可访问的仓库内容中。模型体积和 PyTorch 内存消耗可能影响免费实例的启动时间与运行能力。

## 健康检查

部署后访问：

```text
GET https://your-render-service.onrender.com/health
```

预期响应：

```json
{"status": "ok"}
```
