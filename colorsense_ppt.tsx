import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Cpu, 
  Palette, 
  Sparkles, 
  Activity, 
  Database, 
  Smartphone, 
  GitBranch, 
  TrendingUp, 
  Award, 
  Play, 
  CheckCircle, 
  Compass, 
  Monitor, 
  Video, 
  Maximize2,
  Users,
  Code,
  ArrowRight,
  BookOpen
} from 'lucide-react';

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showProgress, setShowProgress] = useState(true);

  // PPT 页面配置
  const slides = [
    // 1. 封面页
    {
      id: "cover",
      category: "PROJECT COVER",
      title: "ColorSense / ColorInsight",
      subtitle: "AI 四季色彩诊断与个人风格推荐 Web App",
      tagline: "一张照片，生成你的专属色彩档案与穿搭灵感",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-left">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-[#578af4]/10 text-[#578af4] w-fit">
              课程期末项目答辩汇报
            </span>
            <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-[#181698] leading-tight">
              ColorSense <br />
              <span className="text-[#578af4]">&</span> ColorInsight
            </h1>
            <p className="text-lg lg:text-xl text-slate-6xl text-slate-600 font-medium">
              基于深度学习的个人色彩智能识别与产品化 AI 协作开发实战
            </p>
            <div className="pt-6 border-t border-slate-200/60 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1">汇报人 / 团队</span>
                <span className="text-sm font-semibold text-slate-700">ColorSense 联合创作者</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">技术栈体系</span>
                <span className="text-sm font-semibold text-slate-700">Next.js 14 + FastAPI + PyTorch</span>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 relative flex justify-center items-center">
            {/* 视觉抽象背景：四个季节色卡交融的玻璃态圆形 */}
            <div className="relative w-80 h-80 rounded-full bg-gradient-to-tr from-[#eef6ff] to-[#f4f8fe] shadow-2xl flex items-center justify-center border border-white/40 overflow-hidden">
              <div className="absolute top-4 left-4 w-28 h-28 rounded-full bg-[#FFB5A7]/70 filter blur-xl animate-pulse"></div>
              <div className="absolute top-4 right-4 w-28 h-28 rounded-full bg-[#B8D4E8]/70 filter blur-xl animate-pulse delay-75"></div>
              <div className="absolute bottom-4 left-4 w-28 h-28 rounded-full bg-[#C47B4E]/50 filter blur-xl animate-pulse delay-150"></div>
              <div className="absolute bottom-4 right-4 w-28 h-28 rounded-full bg-[#1A1A2E]/20 filter blur-xl animate-pulse delay-200"></div>
              
              <div className="z-10 p-6 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-lg text-center max-w-[240px]">
                <Palette className="w-8 h-8 mx-auto text-[#181698] mb-3 animate-bounce" />
                <h3 className="text-base font-bold text-[#181698]">AI 四季色型识别</h3>
                <p className="text-xs text-slate-500 mt-1">图像分类算法 + 个人特征问卷 + 智能风格引擎</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // 2. 项目概述
    {
      id: "overview",
      category: "INTRODUCTION",
      title: "项目概述：从色彩测试到个人风格产品",
      subtitle: "解决从“单纯娱乐测试”到“可持续生活助手”的用户刚需",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="p-4 rounded-xl bg-white/70 border border-slate-200/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 rounded-lg bg-[#FFB5A7]/20 text-[#181698]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#181698] text-base">灵感起源</h4>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                起源于风靡全球的韩国线下个人色彩测试（Personal Color Test）。现代人对于通过科学色彩、MBTI 等标签探索自我、优化个人形象拥有极强的心理诉求。
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/70 border border-slate-200/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 rounded-lg bg-[#B8D4E8]/20 text-[#578af4]">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#181698] text-base">核心痛点</h4>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                线下诊断价格昂贵（数千元/次），而普通线上 H5 纯属随机概率小游戏。用户测完后“只得到了一个空洞的结论”，依然不知道“明天该怎么穿，雷区是什么”。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#578af4]/5 border border-[#578af4]/20 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 rounded-lg bg-[#578af4]/15 text-[#578af4]">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#181698] text-base">ColorSense 的使命</h4>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                将专业的深度学习色彩分类算法、个性化形象档案管理与大语言模型穿搭顾问无缝结合，提供高精度的即时色彩诊断与长期的全场景 OOTD 穿搭灵感。
              </p>
            </div>
          </div>
          
          <div className="lg:col-span-6 bg-white/80 p-6 rounded-2xl border border-[#81bfe9]/20 shadow-xl flex flex-col justify-between h-full max-h-[380px]">
            <h5 className="font-bold text-xs text-slate-400 uppercase tracking-widest mb-4">用户闭环旅程预览</h5>
            <div className="relative flex flex-col justify-around flex-grow space-y-4 pl-4 border-l-2 border-[#578af4]/30">
              <div className="relative">
                <div className="absolute -left-[23px] top-1.5 w-2 h-2 rounded-full bg-[#181698]"></div>
                <span className="text-xs font-bold text-[#181698] bg-[#181698]/5 px-2 py-0.5 rounded">STEP 01</span>
                <p className="text-sm font-semibold text-slate-700 mt-1">上传正面人像照 → 自动完成多关键点人脸检测</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[23px] top-1.5 w-2 h-2 rounded-full bg-[#578af4]"></div>
                <span className="text-xs font-bold text-[#578af4] bg-[#578af4]/5 px-2 py-0.5 rounded">STEP 02</span>
                <p className="text-sm font-semibold text-slate-700 mt-1">融合12维底层色彩特征与 EfficientNet 推理分类</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[23px] top-1.5 w-2 h-2 rounded-full bg-[#81bfe9]"></div>
                <span className="text-xs font-bold text-[#81bfe9] bg-[#81bfe9]/5 px-2 py-0.5 rounded">STEP 03</span>
                <p className="text-sm font-semibold text-slate-700 mt-1">智能联动天气、场合、心情，生成每日 OOTD 穿搭方案</p>
              </div>
            </div>
            <div className="mt-4 bg-[#f4f8fe] p-2.5 rounded-lg text-center">
              <span className="text-xs text-[#181698] font-semibold">实现结果：一个高完成度、科学而非娱乐性的美学服务 App</span>
            </div>
          </div>
        </div>
      )
    },
    // 3. 项目创新点
    {
      id: "innovations",
      category: "HIGHLIGHTS",
      title: "项目核心创新维度",
      subtitle: "多角度打破传统工具壁垒，实现技术、体验与开发的全面飞跃",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full items-center">
          {[
            {
              icon: <Cpu className="w-6 h-6 text-[#181698]" />,
              title: "科学多维色彩算法",
              desc: "不依赖单一卷积特征，开创性融合 Lab + HSV 共12维面部特征统计数据，让神经网络拥有明确的色彩学先验。"
            },
            {
              icon: <Palette className="w-6 h-6 text-[#578af4]" />,
              desc: "拒绝冷冰冰的概率，将诊断结果全方位转换为匹配色卡、雷区色避雷针、高阶风格词，让穿搭指导更具实操性。",
              title: "从单点分类到闭环服务"
            },
            {
              icon: <Layers className="w-6 h-6 text-[#81bfe9]" />,
              title: "高沉淀个人美学档案",
              desc: "内置注册账户，沉淀个人形象档案，搭配 HTML-to-Image 导出，让每一次测试成为可追溯的时尚进化历程。"
            },
            {
              icon: <GitBranch className="w-6 h-6 text-[#addce6]" />,
              title: "Vibe Coding 协作范式",
              desc: "全链路深度践行“AI 协作开发”，利用 Agent 提问、PRD 前置、子模块并行与验收，效率相比常规编码提升300%。"
            }
          ].map((item, index) => (
            <div key={index} className="p-5 bg-white rounded-xl border border-slate-200/60 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-[280px]">
              <div>
                <div className="p-3 bg-slate-50 rounded-xl w-fit mb-4 border border-slate-100">
                  {item.icon}
                </div>
                <h4 className="text-base font-bold text-[#181698] mb-2">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-300">0{index + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )
    },
    // 4. 技术路线总览
    {
      id: "architecture-summary",
      category: "TECHNICAL ROUTE",
      title: "技术路线总览：模型训练与网站开发双轨制",
      subtitle: "两条主线高效并发，通过诊断推理 API 实现无缝联动",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          {/* 左侧：算法主线 */}
          <div className="lg:col-span-5 bg-white/70 p-5 rounded-xl border border-slate-200/50 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Cpu className="w-4 h-4 text-[#181698]" />
              <h4 className="font-extrabold text-sm text-[#181698]">TRACK A: 模型算法研发主线</h4>
            </div>
            
            <div className="space-y-3">
              {[
                { title: "Deep Armocromia 数据清洗", detail: "过滤由于多脸/低画质导致的杂质图片" },
                { title: "MediaPipe 正面人脸对齐裁剪", detail: "排除发色背景干扰，聚焦核心肤质区域" },
                { title: "色彩统计特征提取", detail: "计算 Lab/HSV 空间均值与标准差" },
                { title: "模型选择与集成", detail: "CNN → ResNet18 → EfficientNet-B0" },
                { title: "FastAPI 高性能部署", detail: "封装 `SeasonNet` 推理并提供安全保障机制" }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-3 text-left">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#181698]/10 text-[#181698] flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">{step.title}</h5>
                    <p className="text-[10px] text-slate-400">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 中间桥梁 */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center space-y-2 py-4">
            <div className="h-10 w-[2px] bg-gradient-to-b from-[#181698] to-[#578af4] hidden lg:block"></div>
            <div className="px-3 py-1.5 rounded-full bg-[#578af4]/10 border border-[#578af4]/20 text-[#578af4] text-xs font-bold text-center z-10 whitespace-nowrap">
              FastAPI RESTful API
            </div>
            <div className="h-10 w-[2px] bg-gradient-to-b from-[#578af4] to-[#81bfe9] hidden lg:block"></div>
          </div>

          {/* 右侧：产品主线 */}
          <div className="lg:col-span-5 bg-white/70 p-5 rounded-xl border border-slate-200/50 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Smartphone className="w-4 h-4 text-[#578af4]" />
              <h4 className="font-extrabold text-sm text-[#578af4]">TRACK B: 网站工程产品化主线</h4>
            </div>
            
            <div className="space-y-3">
              {[
                { title: "Next.js 14 App Router 极速架设", detail: "前后端混编架构，极致的静态渲染与动态交互" },
                { title: "Firebase 全栈认证与存储", detail: "邮箱及 Google Auth + Firestore 实时数据层" },
                { title: "动态个性化大模型顾问", detail: "整合 LLM，通过诊断数据推荐天气专属 OOTD" },
                { title: "历史归档与多端无损导出", detail: "html2canvas 动态渲染 + JSZip 高效压缩" },
                { title: "Vercel / Render 自动构建托管", detail: "打通生产链路，实现敏捷、安全的全球部署" }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-3 text-left">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#578af4]/10 text-[#578af4] flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">{step.title}</h5>
                    <p className="text-[10px] text-slate-400">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      )
    },
    // 5. 模型任务与数据集
    {
      id: "dataset",
      category: "DATASET & DEFINITION",
      title: "模型任务定义与数据集清洗",
      subtitle: "基于 Deep Armocromia 精准构建四季人脸图像数据集",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          {/* 左侧：任务定义卡 */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm text-left">
              <h4 className="text-sm font-bold text-[#181698] mb-2 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#181698] rounded-full inline-block"></span>
                图像分类（四分类任务）
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                模型通过提取并解析人脸肤色、瞳孔深度、面部阴影及毛发底层冷暖信息，判定输入目标属于春、夏、秋、冬哪一季。
              </p>
            </div>
            
            <div className="p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm text-left">
              <h4 className="text-sm font-bold text-[#181698] mb-2 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#578af4] rounded-full inline-block"></span>
                数据输入与输出
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li><strong>输入：</strong>清晰正面单人肖像（经过 Face Crop 消除多余发型/衣服干扰）</li>
                <li><strong>输出：</strong>春、夏、秋、冬各个类别的概率向量及置信度。</li>
              </ul>
            </div>
            
            <div className="p-4 bg-[#FFB5A7]/10 rounded-xl border border-[#FFB5A7]/30 text-left">
              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">数据局限性</span>
              <p className="text-xs text-red-800 mt-1">
                Deep Armocromia 原数据集主要面向欧美人群，亚洲面孔样本较少。在下一阶段，我们将对亚洲肤质分类和光线稳定性做专项数据补偿。
              </p>
            </div>
          </div>
          
          {/* 右侧：数据集可视化 */}
          <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-[#81bfe9]/20 shadow-md flex flex-col justify-between h-full max-h-[340px]">
            <h4 className="text-sm font-bold text-[#181698] mb-3 text-left">清洗前后类别样本对比 (4920张 ↘ 4660张)</h4>
            
            <div className="space-y-3">
              {[
                { name: "春季 (Spring)", raw: 1181, clean: 1124, color: "bg-[#FFB5A7]" },
                { name: "夏季 (Summer)", raw: 1129, clean: 1069, color: "bg-[#B8D4E8]" },
                { name: "秋季 (Autumn)", raw: 1305, clean: 1246, color: "bg-[#C47B4E]" },
                { name: "冬季 (Winter)", raw: 1305, clean: 1221, color: "bg-[#1A1A2E]" }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1 text-left">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color} inline-block`}></span>
                      {item.name}
                    </span>
                    <span className="text-slate-400">
                      清洗前: {item.raw}张 <span className="text-slate-600 font-bold">→ 清洗后 (Face Crop): {item.clean}张</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                    <div className={`${item.color} h-full rounded-l-full`} style={{ width: `${(item.clean / 1305) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-[10px] text-slate-400 text-center mt-3 bg-slate-50 py-1.5 rounded">
              数据清洗流程：扫描所有图片 ➔ 人脸边界框校验 ➔ 滤除多脸、脸部模糊、歪斜角度过大样本 ➔ 导出 4660 个高质量高分辨率 Face-Crop 块。
            </p>
          </div>
          
        </div>
      )
    },
    // 6. 模型训练流程
    {
      id: "pipeline",
      category: "TRAINING PIPELINE",
      title: "端到端模型训练流程与底层技术",
      subtitle: "严谨的科研级预处理与多维度显式统计特征融合",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          <div className="lg:col-span-8 space-y-4">
            <div className="relative flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200/50">
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0 hidden md:block"></div>
              
              {[
                { title: "1. 标签映射", desc: "意大利语 → 英文四季标签", bg: "bg-white" },
                { title: "2. 智能人脸定位", desc: "MediaPipe 生成 Face Crop", bg: "bg-white" },
                { title: "3. 归一化缩放", desc: "ImageNet 标准预处理", bg: "bg-white" },
                { title: "4. 渐进式增强", desc: "轻微微旋转、对比度微调", bg: "bg-white" }
              ].map((step, idx) => (
                <div key={idx} className={`z-10 p-3 rounded-lg border border-slate-200/60 shadow-sm w-[23%] text-left ${step.bg}`}>
                  <span className="text-xs font-bold text-[#578af4] block mb-1">STEP 0{idx + 1}</span>
                  <h5 className="text-xs font-bold text-[#181698]">{step.title}</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal">{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200/60 text-left shadow-sm">
                <h4 className="text-xs font-extrabold text-[#181698] mb-2 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[#578af4]" />
                  双空间 (Lab + HSV) 颜色特征融合
                </h4>
                <p className="text-xs text-slate-500 leading-normal">
                  深度卷积模型虽然空间感知极强，但极易忽略面部冷暖色调在经典色彩空间的分布细节。我们提取面部局部剪裁的 <strong>Lab 均值/标准差</strong> 及 <strong>HSV 均值/标准差</strong>（共 12 维特征），作为额外的特征映射层强制拼接到最终的 FC 层，极大地提升了决策稳定性。
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200/60 text-left shadow-sm">
                <h4 className="text-xs font-extrabold text-[#181698] mb-2 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#578af4]" />
                  EarlyStopping 与分层验证机制
                </h4>
                <p className="text-xs text-slate-500 leading-normal">
                  采用 <strong>Stratified ShuffleSplit</strong>，确保 Train/Val/Test 集中各季节分类比例一致，避免多重泛化倾斜；同时设立 <strong>Patience = 5</strong> 的 EarlyStopping 哨兵，辅以 <strong>Macro F1</strong> 为训练的主导评价指标，有效避免了长尾效应下的过拟合。
                </p>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 bg-gradient-to-tr from-[#181698] to-[#578af4] p-5 rounded-xl text-white text-left shadow-lg h-full flex flex-col justify-between max-h-[320px]">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#addce6] font-bold">CORE PARADIGM</span>
              <h4 className="text-lg font-bold mt-1 mb-2">深度学习 + 显式专家经验</h4>
              <p className="text-xs text-white/80 leading-relaxed">
                “我们并不只指望模型自己去发现 RGB 的微妙组合。通过直接传入 Lab 亮度和冷暖通道，模型在收敛速度和对不同光照面孔的抗干扰能力上取得了质的飞跃。”
              </p>
            </div>
            <div className="border-t border-white/20 pt-3">
              <span className="text-xs block text-[#addce6]">模型综合诊断鲁棒度</span>
              <div className="w-full bg-white/20 rounded-full h-2 mt-1.5">
                <div className="bg-[#addce6] h-full rounded-full" style={{ width: "88%" }}></div>
              </div>
            </div>
          </div>

        </div>
      )
    },
    // 7. 模型迭代与演进
    {
      id: "evolution",
      category: "MODEL EVOLUTION",
      title: "模型迭代过程：从简单 CNN 到 EfficientNet-B0",
      subtitle: "历经三个关键节点，步步逼近最佳泛化指标",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-center">
          
          {[
            {
              phase: "STAGE 01",
              name: "v1_clean_cnn",
              desc: "作为流程验证 Baseline 极速跑通",
              details: [
                "自研轻量级 4 层卷积池化网络",
                "无任何 ImageNet 迁移权重",
                "未接入任何特征融合和显式辅助特征",
                "仅能识别人像最浅表性的色彩轮廓"
              ],
              status: "开发验证期",
              color: "border-slate-200",
              badge: "bg-slate-100 text-slate-500"
            },
            {
              phase: "STAGE 02",
              name: "resnet18_color",
              desc: "引入预训练权重与颜色融合",
              details: [
                "改用经典的 ResNet-18 特征提取器",
                "首创融合 12 维 Lab/HSV 空间特征向量",
                "引入 Stratified 分层优化机制",
                "测试集 Macro F1 指标大幅飙升 27.2%"
              ],
              status: "核心突破期",
              color: "border-[#81bfe9]/40",
              badge: "bg-[#81bfe9]/15 text-[#181698]"
            },
            {
              phase: "STAGE 03",
              name: "efficientnet_b0_color",
              desc: "参数高集成度与性能完美平衡",
              details: [
                "轻量级 EfficientNet-B0 骨干网络",
                "极佳的推理延迟，单次请求响应低于200ms",
                "泛化性能拉满，模型轻巧便于在小服务器部署",
                "综合 Accuracy 达到 60.1%，Macro F1 创下纪录"
              ],
              status: "最终候选方案",
              color: "border-[#578af4]/60 bg-[#578af4]/5",
              badge: "bg-[#578af4]/15 text-[#578af4]"
            }
          ].map((stage, idx) => (
            <div key={idx} className={`p-5 rounded-xl border shadow-md hover:shadow-lg transition-all duration-300 text-left flex flex-col justify-between h-[320px] bg-white ${stage.color}`}>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400">{stage.phase}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stage.badge}`}>{stage.status}</span>
                </div>
                <h4 className="text-lg font-extrabold text-[#181698] font-mono">{stage.name}</h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">{stage.desc}</p>
                
                <ul className="mt-4 space-y-2">
                  {stage.details.map((detail, dIdx) => (
                    <li key={dIdx} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-[#578af4] mt-0.5">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">选择度</span>
                <span className="text-xs font-bold text-[#181698]">{idx === 2 ? "★★★★★ (生产环境)" : "★☆☆☆☆"}</span>
              </div>
            </div>
          ))}

        </div>
      )
    },
    // 8. 实验结果展示
    {
      id: "results",
      category: "EXPERIMENTAL RESULTS",
      title: "实验结果对比：寻找最优泛化性能",
      subtitle: "多项真实量化指标印证优化路径的正确性",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          {/* 左侧：表格对比 */}
          <div className="lg:col-span-7 overflow-x-auto">
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-md overflow-hidden text-left">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#181698] text-white">
                    <th className="p-3 font-semibold">评估模型</th>
                    <th className="p-3 font-semibold text-center">Best Epoch</th>
                    <th className="p-3 font-semibold text-center">Best Val Macro F1</th>
                    <th className="p-3 font-semibold text-center">Test Loss</th>
                    <th className="p-3 font-semibold text-center">Test Acc</th>
                    <th className="p-3 font-semibold text-center">Test Macro F1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-700">v1_clean_cnn</td>
                    <td className="p-3 text-center text-slate-500">5</td>
                    <td className="p-3 text-center text-slate-500 font-mono">0.438132</td>
                    <td className="p-3 text-center text-slate-500 font-mono">1.206494</td>
                    <td className="p-3 text-center text-red-500 font-semibold font-mono">46.92%</td>
                    <td className="p-3 text-center text-red-500 font-semibold font-mono">0.457828</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-700">resnet18_color</td>
                    <td className="p-3 text-center text-slate-500">6</td>
                    <td className="p-3 text-center text-slate-500 font-mono">0.565540</td>
                    <td className="p-3 text-center text-slate-500 font-mono">0.959629</td>
                    <td className="p-3 text-center text-slate-700 font-semibold font-mono">58.37%</td>
                    <td className="p-3 text-center text-slate-700 font-semibold font-mono">0.582372</td>
                  </tr>
                  <tr className="hover:bg-[#578af4]/5 transition-colors">
                    <td className="p-3 font-bold text-[#181698]">efficientnet_b0_color</td>
                    <td className="p-3 text-center text-[#181698] font-bold">12</td>
                    <td className="p-3 text-center text-[#181698] font-mono font-bold">0.557834</td>
                    <td className="p-3 text-center text-[#181698] font-mono">0.981513</td>
                    <td className="p-3 text-center text-[#578af4] font-extrabold font-mono text-sm">60.09%</td>
                    <td className="p-3 text-center text-[#578af4] font-extrabold font-mono text-sm">0.599448</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/50 text-left">
              <span className="text-[10px] font-bold text-[#181698] uppercase">结论摘要</span>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                <strong>EfficientNet-B0</strong> 展现出了无可比拟的深层特征提取天赋。尽管由于面部色彩本身存在着极其微妙的渐进式过渡（分类难度大），其整体 Accuracy 仍跨越了 <strong>60% 门槛</strong>。最重要的是，其 <strong>Macro F1</strong> 表现最为均衡，极大规避了由于类别冷门导致的错误诊断。
              </p>
            </div>
          </div>
          
          {/* 右侧：单体报告 */}
          <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200/50 shadow-md flex flex-col justify-between h-full max-h-[320px] text-left">
            <div>
              <h4 className="text-xs font-bold text-[#181698] uppercase tracking-widest mb-3">EfficientNet-B0 混淆预测概览</h4>
              
              <div className="space-y-2">
                {[
                  { label: "春季 (Spring) F1-Score", val: "0.5417", pct: 54 },
                  { label: "夏季 (Summer) F1-Score", val: "0.5865", pct: 58 },
                  { label: "秋季 (Autumn) F1-Score", val: "0.6011", pct: 60 },
                  { label: "冬季 (Winter) F1-Score", val: "0.6685", pct: 66 }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600">
                      <span>{item.label}</span>
                      <span className="font-bold text-[#181698]">{item.val}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#578af4] h-full" style={{ width: `${item.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
              <span className="text-slate-400">平均 Accuracy</span>
              <span className="font-extrabold text-lg text-[#578af4]">60.09%</span>
            </div>
          </div>

        </div>
      )
    },
    // 9. 后端推理流程
    {
      id: "backend",
      category: "BACKEND PROCESSOR",
      title: "FastAPI 推理流程与坚不可摧的人脸校验",
      subtitle: "通过严苛过滤保障输入高置信度，拒绝劣质图片污染核心数据",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          {/* 左侧：后端核心校验逻辑 */}
          <div className="lg:col-span-6 space-y-4 text-left">
            <div className="p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-[#FFB5A7]/20 text-[#181698] rounded">核心拦截门槛</span>
              <h4 className="text-sm font-bold text-[#181698] mt-2 mb-1.5">MIN_FACE_CONFIDENCE = 0.80</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                为保证诊断的科学可靠，FastAPI 推理服务内建了高阶人脸定位防御哨兵。任何缺少正面大眼睛/全脸五官、模糊、或检测出多张面孔的图片都会被一律拒绝，直接反馈 <code>422 NO_CLEAR_FACE</code>，绝不进行含糊不清的猜测。
              </p>
            </div>
            
            <div className="p-4 bg-[#181698]/5 rounded-xl border border-[#181698]/10">
              <h4 className="text-xs font-bold text-[#181698] mb-1.5">正式生产环境限制条件</h4>
              <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                <li>严格格式校验：仅放行 JPG / JPEG / PNG / HEIC / HEIF</li>
                <li>文件大小上限：限制为 10MB，防止后端内存溢出与恶意 DDoS</li>
                <li>绝对模型驱动：不接受 Rules fallback 作为存档，诊断结果强制标定 <code>source="model"</code> 确保纯粹性。</li>
              </ul>
            </div>
          </div>

          {/* 右侧：流程可视化卡片 */}
          <div className="lg:col-span-6 flex flex-col justify-between h-full bg-white p-5 rounded-xl border border-[#81bfe9]/20 shadow-md max-h-[320px]">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">一幅图片在后端的生命周期</h4>
            
            <div className="space-y-2 relative pl-6 border-l border-dashed border-[#578af4]/40 text-left">
              {[
                { title: "Multipart 接收图片", desc: "读取文件二进制数据流，拦截异常大小与命名漏洞" },
                { title: "MediaPipe 人脸解算", desc: "提取人脸 2D 轮廓关键点，分析偏摆姿态，完成精细 face crop 裁剪" },
                { title: "RGB ➔ Lab + HSV 运算", desc: "对面部肤质裁剪区块快速执行色彩直方图解算，抽取出 12 维均值标准差" },
                { title: "SeasonNet 双核推理", desc: "将多层卷积抽象高维特征与 12 维色彩空间特征强力拼合，最终 Softmax 归一化输出" }
              ].map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[30px] top-1 w-3 h-3 rounded-full bg-[#578af4] border-2 border-white"></div>
                  <h5 className="text-xs font-bold text-slate-700">{item.title}</h5>
                  <p className="text-[10px] text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )
    },
    // 10. 网站系统架构
    {
      id: "architecture",
      category: "SYSTEM ARCHITECTURE",
      title: "系统微服务架构：高效的双轮协同",
      subtitle: "前端 Next.js 服务与后端 FastAPI 完美解耦，保障云端的高效可用",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          {/* 左侧：架构层次化解析 */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="p-4 bg-white rounded-xl border border-slate-200/60 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-[#578af4]/10 text-[#578af4]">
                  <Monitor className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#181698]">表现与交互层 (Front)</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal mb-3">
                Next.js 14、React 18 与 Tailwind CSS 的黄金组合。基于 App Router 设计出极致清爽的玻璃拟态卡片式 UI 体验。
              </p>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Deploy on Vercel</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/60 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-[#578af4]/10 text-[#578af4]">
                  <Database className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#181698]">无服务器数据层 (Firebase)</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal mb-3">
                Firebase Auth 提供邮箱注册与第三方 Google 安全登录，Firestore 保存持久化用户诊断历史归档与个性化配置档案。
              </p>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Firebase Spark</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/60 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-[#578af4]/10 text-[#578af4]">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#181698]">高性能算法推理层 (Model)</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal mb-3">
                基于 FastAPI 搭建的高速推理服务，单机多核极速加载 best_model.pth，通过高度隔离的 API 提供跨域支持。
              </p>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Deploy on Render</span>
            </div>

          </div>

          {/* 右侧：数据流通路图 */}
          <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200/60 shadow-md text-left flex flex-col justify-between h-full max-h-[320px]">
            <div>
              <h4 className="text-xs font-bold text-[#181698] tracking-widest uppercase mb-3">全链路数据流向路线</h4>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">1. 用户上传肖像</span>
                  <span className="text-slate-700 font-semibold">Web Client</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">2. 自治 Auth 校验拦截</span>
                  <span className="text-slate-700 font-semibold">Firebase API</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">3. 推送至模型容器</span>
                  <span className="text-[#578af4] font-semibold">Render Node</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">4. 大模型风格生成</span>
                  <span className="text-slate-700 font-semibold">LLM APIs</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-400">5. 诊断归纳持久化</span>
                  <span className="text-slate-700 font-semibold">Firestore db</span>
                </div>
              </div>
            </div>
            <div className="bg-[#578af4]/5 p-2 rounded text-center">
              <span className="text-[10px] font-semibold text-[#181698]">整个过程平均耗时: 1.2s (高度并发)</span>
            </div>
          </div>

        </div>
      )
    },
    // 11. 核心产品功能
    {
      id: "features",
      category: "PRODUCT FEATURES",
      title: "核心产品功能展示：完整度极高的美学管理系统",
      subtitle: "六大核心模块共同组合，带给用户最流畅、贴心的个人顾问体验",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full items-center">
          {[
            { title: "全网安全账户登录", icon: <CheckCircle className="text-emerald-500" />, detail: "完整提供传统邮箱验证与 Google 一键快捷绑定，有效防止恶意诊断垃圾流量。" },
            { title: "个人美学档案问卷", icon: <Layers className="text-[#578af4]" />, detail: "精准定义用户主观发色偏好、骨骼身型特征和高频日常穿搭雷区，沉淀用户核心档案。" },
            { title: "高精度上传及诊断", icon: <Palette className="text-[#578af4]" />, detail: "可视化进度条与严格报错提示，提供高清晰人脸对准检测，测后跳转沉浸式结果展示。" },
            { title: "专业多层级诊断卡片", icon: <Activity className="text-amber-500" />, detail: "精确提供置信度曲线、四季分值比例、最佳匹配建议色、防避雷禁忌色、搭配策略等细节。" },
            { title: "长效美学日记与归档", icon: <Database className="text-[#578af4]" />, detail: "诊断历史云端永久储存，支持一键多记录管理、删除，通过 zip 将图片打包高速无损下载。" },
            { title: "今日天气 OOTD 灵感", icon: <Sparkles className="text-amber-500" />, detail: "整合 LLM，实时联动本地地理天气、用户所选出席场合与今日心情，生成专属时尚建议。" }
          ].map((feat, idx) => (
            <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200/60 shadow-sm text-left flex gap-3 h-[140px] items-start hover:shadow-md transition-shadow">
              <div className="p-2 bg-slate-50 rounded-lg mt-0.5 border border-slate-100 flex-shrink-0">
                {feat.icon}
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-[#181698]">{feat.title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{feat.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    // 12. 用户旅程路径
    {
      id: "journey",
      category: "USER JOURNEY",
      title: "全路径体验：从首次接触到深度穿搭转化",
      subtitle: "完美的单向递进链路，带来高强度的心理获得感与长效留存",
      content: (
        <div className="h-full flex flex-col justify-center space-y-8">
          
          <div className="relative flex justify-between items-center px-4">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#eef6ff] via-[#578af4]/40 to-[#eef6ff] -translate-y-1/2 z-0"></div>
            
            {[
              { num: "01", stage: "安全验证", info: "注册及谷歌一键登录" },
              { num: "02", stage: "定制偏好", info: "填写首个美学问卷" },
              { num: "03", stage: "精准上传", info: "人脸实时哨兵防模糊" },
              { num: "04", stage: "获取报告", info: "四季诊断及配对色卡" },
              { num: "05", stage: "灵感推荐", info: "结合天气穿搭穿衣" },
              { num: "06", stage: "保存分享", info: "PNG 高清图极速归档" }
            ].map((step, idx) => (
              <div key={idx} className="z-10 flex flex-col items-center text-center max-w-[12%]">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-[#578af4] text-[#181698] font-bold flex items-center justify-center shadow-md hover:scale-115 transition-transform duration-300">
                  {step.num}
                </div>
                <h5 className="text-xs font-bold text-[#181698] mt-2">{step.stage}</h5>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal hidden md:block">{step.info}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/80 p-5 rounded-2xl border border-slate-200/60 shadow-md text-left">
            <h4 className="text-xs font-bold text-[#181698] mb-1">设计哲学：不仅是一个玩具，而是一个有生命力的数据集散地</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              传统的测试产品测试后，结果往往随着窗口关闭而烟消云散，毫无长尾可言。在 ColorSense 的世界里，通过将问卷信息、用户测出季型与大模型做跨域融合，每一次用户的点击都会在后台转为更有用的穿搭灵感，让工具具备了真正的生活价值与陪伴属性。
            </p>
          </div>

        </div>
      )
    },
    // 13. 录屏视频展示
    {
      id: "demo",
      category: "LIVE DEMO VIDEO",
      title: "系统实装录屏演示预留页",
      subtitle: "面向现场答辩的沉浸式操作实拍，展示极致流畅的极速体验",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          {/* 左侧：精美的玻璃视频占位框 */}
          <div className="lg:col-span-8 bg-slate-100 rounded-xl border border-[#81bfe9]/30 overflow-hidden relative shadow-inner aspect-video flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-[#eef6ff] to-white">
            <div className="p-4 rounded-full bg-[#181698]/10 text-[#181698] mb-3 animate-ping">
              <Video className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-[#181698] uppercase tracking-wider">答辩演示视频 (16:9 MP4 预留区)</p>
            <p className="text-xs text-slate-400 mt-1">【建议在此置入录制的真实系统操作视频，充分打动答辩老师】</p>
            
            <button className="mt-4 px-4 py-2 bg-[#181698] hover:bg-[#578af4] text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-md transition-colors">
              <Play className="w-3.5 h-3.5 fill-current" /> 启动全功能流程预览
            </button>
          </div>

          {/* 右侧：严格的现场录制清单 */}
          <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200/50 shadow-md text-left flex flex-col justify-between h-full max-h-[320px]">
            <div>
              <h4 className="text-xs font-bold text-[#181698] tracking-widest uppercase mb-3">录屏核心功能自查清单</h4>
              <div className="space-y-2">
                {[
                  "展示炫酷清爽的玻璃卡片式首页 UI",
                  "完成邮箱安全注册，跳转至档案问卷填写",
                  "上传标准正面人像图片，展示检测哨兵",
                  "成功吐出精确的诊断概率并显示配对色卡",
                  "打开美学历史记录，批量下载 PNG 归档",
                  "开启 OOTD 今日穿搭模块，展示大模型对话建议"
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-xs text-slate-600">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block border-t border-slate-50 pt-2 text-center">
              建议录制时间控制在 90 - 120 秒，重点突出响应极速。
            </span>
          </div>

        </div>
      )
    },
    // 14. Vibe Coding 协作开发
    {
      id: "vibecoding",
      category: "COLLABORATIVE PARADIGM",
      title: "特色开发方法：Vibe Coding 深度实践",
      subtitle: "探索人脑需求与人工智能 Agent 编写的超级桥梁",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-center">
          
          <div className="lg:col-span-7 space-y-4 text-left">
            <p className="text-xs text-slate-500 leading-relaxed">
              在本项目中，我们拒绝了“闷头手敲键盘”的传统落后流水线。通过将 AI 作为真正的协同合伙人，实施了极致高效的 <strong>Vibe Coding（氛围编程 / 人机共生编程）</strong>，让开发进度一日千里。
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm">
                <h4 className="text-xs font-bold text-[#181698] mb-1.5 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-[#578af4]" />
                  1. LLM 反向审视自问
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  我们并不直接让 AI 产出代码，而是先将模糊的产品想法推送给它，让 AI 站在系统分析师的角度反向对人类提出问题。这帮我们规避了数个由于边界场景未明确导致的毁灭性架构漏洞。
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm">
                <h4 className="text-xs font-bold text-[#181698] mb-1.5 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-[#578af4]" />
                  2. 执行级 Prompt 控制
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  我们将所有的功能逻辑高度解耦为“模块化执行指令”。每一个 Agent 都有明确的角色假定、技术堆栈契约、严密的接口协议和校验规则，极力杜绝代码的幻觉性偏斜。
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm text-left flex flex-col justify-between h-full max-h-[320px]">
            <div>
              <h4 className="text-xs font-extrabold text-[#181698] uppercase tracking-widest mb-3">AI 协同开发拓扑网络</h4>
              <div className="space-y-2.5">
                {[
                  { title: "前置需求 (PRD 撰写)", role: "AI 交互问答机制定义" },
                  { title: "中枢架构搭建 (Next.js Setup)", role: "Agent 自动配置路由逻辑" },
                  { title: "多线程子任务并行 (API & Components)", role: "分派给独立子 Agent 极速编写" },
                  { title: "严格阶段性人类验收 (Feedback Loop)", role: "运行、评估并一键调整" }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-2 text-xs">
                    <span className="font-mono font-bold text-[#578af4]">0{idx + 1}</span>
                    <div>
                      <h5 className="font-bold text-slate-700">{item.title}</h5>
                      <p className="text-[10px] text-slate-400">{item.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )
    },
    // 15. 反思与总结
    {
      id: "reflection",
      category: "METHODOLOGY REFLECTION",
      title: "总结反思：AI 不是平替，而是生产关系的重构",
      subtitle: "高能人机协同模式下的几点深刻方法论沉淀",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-center">
          
          <div className="p-5 bg-white rounded-xl border border-[#578af4]/20 text-left space-y-4 shadow-md">
            <h4 className="text-sm font-bold text-[#181698] flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="w-2.5 h-2.5 bg-[#578af4] rounded-full inline-block"></span>
              在实践中提炼出的先进经验
            </h4>
            
            <div className="space-y-3 text-xs text-slate-600">
              <p>
                <strong>不要把大而空的想法无脑抛给 AI：</strong>模糊的意识形态只会换来臃肿而不可维护的垃圾代码堆积。人类先定义产品和接口协议是 AI 产出好代码的黄金律令。
              </p>
              <p>
                <strong>Prompt 已经晋升为需求工程：</strong>在未来，能够精准书写 PRD、拆解软件开发周期的“翻译家”，将完全具备超越普通底层手敲键盘者的效率优势。
              </p>
            </div>
          </div>

          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-[#181698] flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="w-2.5 h-2.5 bg-[#1A1A2E] rounded-full inline-block"></span>
              人类开发者的终极决策价值
            </h4>
            
            <div className="space-y-3 text-xs text-slate-600">
              <p>
                <strong>产品取舍与审美掌控：</strong>大语言模型能够写出无数平铺直叙的布局，但唯有人类的双眼与同理心能打磨出清爽通透的玻璃拟态和完美适配色彩认知的色卡组合。
              </p>
              <p>
                <strong>核心风险守护人：</strong>从 MediaPipe 置信阈值的决策，到数据集清洗中的多维度平衡过滤，核心技术方案的抉择、质量的终期把关，人类的灵魂永远是系统的中枢神经。
              </p>
            </div>
          </div>

        </div>
      )
    },
    // 16. 未来规划
    {
      id: "future",
      category: "FUTURE PLANS",
      title: "产品演进：多维蓝图规划",
      subtitle: "深度打造高可用、强泛化、广传播的美学交互生态",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-center text-left">
          
          {[
            {
              title: "算法进化 (AI Algorithm)",
              icon: <Cpu className="w-5 h-5 text-[#181698]" />,
              items: [
                "补充亚洲多肤色人群数据集提升泛化性",
                "支持用户多角度、多光照多图片拼合判断",
                "引入概率置信度智能校准系统，消除偏差",
                "将大季节扩充至 12 型细粒度诊断矩阵"
              ],
              color: "bg-[#FFB5A7]/10 border-[#FFB5A7]/30"
            },
            {
              title: "产品升维 (Product UI)",
              icon: <Smartphone className="w-5 h-5 text-[#578af4]" />,
              items: [
                "深度扩充个人色彩进阶动态演变报告",
                "结合用户私人衣柜及化妆品雷区智能匹配",
                "提供 AR 实时镜前试衣色彩辅助调试线",
                "更丰富的诊断图片分享模板与生成器"
              ],
              color: "bg-[#B8D4E8]/15 border-[#B8D4E8]/30"
            },
            {
              title: "社区生态 (Social Hub)",
              icon: <Users className="w-5 h-5 text-emerald-500" />,
              items: [
                "构建美学穿搭社区，引入类似 IG 的展示墙",
                "打造成衣、配饰、美妆商家入驻的分发渠道",
                "打通设计师、专业美学导师线上问诊链路",
                "让用户能在平台无缝交流每日色彩搭配经验"
              ],
              color: "bg-emerald-50 border-emerald-200"
            }
          ].map((column, idx) => (
            <div key={idx} className={`p-5 rounded-xl border shadow-md flex flex-col justify-between h-[300px] bg-white`}>
              <div>
                <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-slate-100">
                  <div className={`p-1.5 rounded-lg ${column.color}`}>
                    {column.icon}
                  </div>
                  <h4 className="font-bold text-xs text-[#181698]">{column.title}</h4>
                </div>
                
                <ul className="space-y-2.5">
                  {column.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-xs text-slate-600 flex items-start gap-1.5 leading-normal">
                      <span className="text-[#578af4] font-bold mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <span className="text-[10px] text-slate-400 font-bold font-mono">ROADMAP 2026</span>
            </div>
          ))}

        </div>
      )
    },
    // 17. 封底页
    {
      id: "thankyou",
      category: "THANK YOU",
      title: "ColorSense / ColorInsight",
      subtitle: "谢谢倾听，敬请指正",
      tagline: "不仅是一次色彩测试，而是一次关于“AI + 美学 + 产品化”的完美尝试",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
          <div className="p-4 rounded-full bg-gradient-to-tr from-[#181698]/10 to-[#578af4]/10 border border-white/60 shadow-md">
            <Palette className="w-12 h-12 text-[#181698] animate-spin" />
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-extrabold text-[#181698] tracking-tight">
            ColorSense / ColorInsight
          </h1>
          
          <p className="text-base text-slate-600 max-w-lg mx-auto">
            “通过科学的底层分类，赋予冰冷的算法感性的美，让每个人发现属于自己的绝妙色彩。”
          </p>
          
          <div className="flex gap-4 items-center justify-center pt-4">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FFB5A7]/20 text-[#181698]">春 - 活力</span>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#B8D4E8]/20 text-[#181698]">夏 - 优雅</span>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#C47B4E]/20 text-white" style={{backgroundColor: "#C47B4E"}}>秋 - 质感</span>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white" style={{backgroundColor: "#1A1A2E"}}>冬 - 经典</span>
          </div>
          
          <span className="text-xs text-slate-400 font-medium">Next.js 14 · FastAPI · Firebase · PyTorch</span>
        </div>
      )
    }
  ];

  // 全屏逻辑
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 导航逻辑
  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  return (
    <div className="min-h-screen bg-[#f4f8fe] text-slate-800 font-sans flex flex-col justify-between overflow-hidden relative selection:bg-[#578af4]/30 selection:text-[#181698]">
      
      {/* 顶部美学柔和渐变晕影 */}
      <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-[#eef6ff] via-[#f8fbff]/50 to-transparent pointer-events-none z-0"></div>
      <div className="absolute -top-12 right-12 w-64 h-64 rounded-full bg-[#addce6]/15 filter blur-3xl pointer-events-none"></div>
      <div className="absolute top-[40%] -left-12 w-80 h-80 rounded-full bg-[#FFB5A7]/10 filter blur-3xl pointer-events-none"></div>

      {/* 幻灯片头部 */}
      <header className="px-6 lg:px-12 py-4 flex justify-between items-center z-10 bg-white/40 backdrop-blur-md border-b border-[#81bfe9]/10 shadow-sm">
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-[#181698]" />
          <div>
            <span className="text-xs font-extrabold text-[#181698] tracking-widest uppercase">ColorSense / ColorInsight</span>
            <span className="hidden md:inline text-[10px] text-slate-400 ml-3 border-l border-slate-300 pl-3">AI 协同开发实战汇报</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 页码选择器 */}
          <select 
            value={currentSlide} 
            onChange={(e) => setCurrentSlide(Number(e.target.value))}
            className="text-xs bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#578af4]"
          >
            {slides.map((slide, idx) => (
              <option key={slide.id} value={idx}>
                第 {idx + 1} 页 - {slide.category}
              </option>
            ))}
          </select>
          
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-600 transition-colors hidden md:block"
            title="切换全屏演示"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 幻灯片内容区域 */}
      <main className="flex-grow flex items-center justify-center p-4 lg:p-8 z-10">
        <div className="w-full max-w-6xl bg-white/68 backdrop-blur-md rounded-2xl border border-white/60 shadow-2xl p-6 lg:p-10 min-h-[480px] flex flex-col justify-between relative overflow-hidden transition-all duration-500">
          
          {/* 页面分类标记 */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#181698]/30 animate-ping"></span>
              <span className="text-xs font-extrabold tracking-widest text-[#578af4] uppercase font-mono">
                {slides[currentSlide].category}
              </span>
            </div>
            <span className="text-xs font-bold text-[#181698] bg-[#181698]/5 px-2.5 py-1 rounded-full font-mono">
              SLIDE {currentSlide + 1} / {slides.length}
            </span>
          </div>

          {/* 核心标题区 (排除封面与封底) */}
          {currentSlide !== 0 && currentSlide !== slides.length - 1 && (
            <div className="text-left mb-6">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-[#181698] tracking-tight">
                {slides[currentSlide].title}
              </h2>
              <p className="text-xs text-[#578af4] mt-1 font-medium">
                {slides[currentSlide].subtitle}
              </p>
            </div>
          )}

          {/* 核心渲染部分 */}
          <div className="flex-grow py-2 animate-fadeIn">
            {slides[currentSlide].content}
          </div>

          {/* 装饰边边：微弱的水彩边缘 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFB5A7] via-[#B8D4E8] to-[#C47B4E]/80"></div>
        </div>
      </main>

      {/* 幻灯片控制导航栏 */}
      <footer className="px-6 lg:px-12 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-10 bg-white/50 backdrop-blur-md border-t border-[#81bfe9]/10">
        <div className="text-xs text-slate-400 font-medium">
          使用左右键盘方向键 &rarr; 或 
          <span className="mx-1 px-1.5 py-0.5 rounded bg-white border text-slate-600 font-mono">Space</span> 
          极速切页
        </div>

        {/* 核心控制钮 */}
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
              currentSlide === 0 
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' 
                : 'bg-white hover:bg-slate-50 text-[#181698] border-slate-200 shadow-sm active:scale-95'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex gap-1.5">
            {slides.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-6 bg-[#181698]' : 'w-2 bg-[#81bfe9]/30 hover:bg-[#81bfe9]/60'
                }`}
                title={`跳转至第 ${idx + 1} 页`}
              />
            ))}
          </div>

          <button 
            onClick={handleNext}
            disabled={currentSlide === slides.length - 1}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
              currentSlide === slides.length - 1 
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' 
                : 'bg-white hover:bg-slate-50 text-[#181698] border-slate-200 shadow-sm active:scale-95'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-[#181698] font-bold">
          课程答辩汇报 · ColorSense 团队荣誉呈现
        </div>
      </footer>
    </div>
  );
}