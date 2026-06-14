# VideoForge Desktop — 设计规格

## 项目定位
离线优先 Electron 桌面应用，用户可在界面自由配置多个数字人/TTS/ASR 服务商，任务执行时按所选 Provider 调用对应 API 或本地模型。

## 技术栈
- 桌面框架：Electron + electron-vite + electron-builder
- 前端：React 18 + TypeScript + Tailwind CSS + shadcn/ui 风格
- 状态管理：Zustand
- 本地数据库：sql.js
- 任务队列：p-queue
- 视频处理：fluent-ffmpeg + 系统 FFmpeg
- HTTP 请求：axios
- 路由：react-router-dom

## 项目结构
```
E:\video-workflow\
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.node.json
├── tsconfig.web.json
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── database.ts
│   │   ├── task-queue.ts
│   │   ├── ProviderManager.ts
│   │   ├── interfaces/
│   │   │   ├── ITalkingPhotoProvider.ts
│   │   │   ├── ITTSProvider.ts
│   │   │   └── IASRProvider.ts
│   │   ├── providers/
│   │   │   ├── talkingphoto/DIDProvider.ts
│   │   │   ├── tts/EdgeTTSProvider.ts
│   │   │   └── asr/WhisperProvider.ts
│   │   ├── workers/
│   │   │   ├── modeA.ts
│   │   │   ├── modeB.ts
│   │   │   └── ffmpeg.ts
│   │   └── utils.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── store/useStore.ts
│           ├── pages/Home.tsx
│           ├── pages/Tasks.tsx
│           ├── pages/TaskDetail.tsx
│           ├── pages/Settings.tsx
│           ├── components/
│           │   ├── ProviderConfigForm.tsx
│           │   ├── TaskCard.tsx
│           │   ├── ProgressBar.tsx
│           │   └── VideoPlayer.tsx
│           └── styles/globals.css
├── resources/bin/
└── README.md
```

## 核心接口
- ITalkingPhotoProvider：id, displayName, requiresApiKey, validateConfig, generate, getConfigSchema
- ITTSProvider：id, displayName, requiresApiKey, validateConfig, synthesize, getConfigSchema
- IASRProvider：id, displayName, requiresApiKey, supportsAlignment, validateConfig, transcribe, getConfigSchema
- 统一返回 ProviderConfigSchema 类型

## ProviderManager
单例模式，启动时注册 EdgeTTSProvider、WhisperProvider、DIDProvider。

## 数据库
- tasks 表：id, mode, status, scriptText, avatarPath, audioPath, outputVideoPath, subtitleSrtPath, talkingPhotoProviderId, ttsProviderId, asrProviderId, talkingPhotoConfig, ttsConfig, asrConfig, createdAt, updatedAt, errorMessage, logFilePath
- settings 表：key TEXT PRIMARY KEY, value TEXT (JSON)

## 任务流程
- 模式A：TTS → ASR(可选) → TalkingPhoto → FFmpeg字幕烧录 → 输出
- 模式B：用户直接提供 audioPath + avatarPath → TalkingPhoto → FFmpeg → 输出
- p-queue 并发数 2，进度通过 IPC 推送前端

## IPC 通道
task:create, tasks:get, task:get, task:cancel, settings:get, settings:save, dialog:openFile, shell:reveal, task:progress

## 前端页面
- / → Home：创建任务，动态 Provider 选择 + 配置表单
- /tasks → Tasks：任务卡片网格，实时进度更新
- /task/:id → TaskDetail：详情、视频预览、下载、重新生成
- /settings → Settings：Provider 全局配置管理

## 文件存储
~/Documents/VideoForge/{output,temp,logs}

## 首批 Provider
- EdgeTTS（免费，无需 API Key）
- Whisper（本地离线，whisper.cpp 子进程调用）
- D-ID（需要 API Key，支持多 Key 轮询）
