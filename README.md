# VideoForge Desktop

可插拔 AI 数字人视频生成桌面应用。用户可在界面自由配置多个数字人/TTS/ASR 服务商，任务执行时按所选 Provider 调用对应 API 或本地模型。

## 技术栈

- **桌面框架**：Electron + electron-vite + electron-builder
- **前端**：React 18 + TypeScript + Tailwind CSS + shadcn/ui 风格组件
- **状态管理**：Zustand
- **数据库**：sql.js
- **任务队列**：p-queue
- **视频处理**：fluent-ffmpeg + 系统 FFmpeg

## 快速开始（当前电脑开发调试）

### 前置要求

- Node.js >= 18
- 系统安装 FFmpeg（用于视频处理）
- 如需使用 Whisper ASR，需下载 whisper.cpp 可执行文件和模型

### 安装依赖

```bash
npm install
```

### 开发调试

```bash
npm run dev
```

### 构建打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac
```

构建完成后，安装包生成在 `release/` 目录下。

---

## 换电脑使用指南

### 方式一：直接安装（仅使用，不开发）

1. 在当前电脑构建安装包：

```bash
npm run build:win
```

2. 将 `release/` 目录下的 `.exe` 安装程序拷贝到新电脑
3. 双击安装即可运行

> 如果需要迁移历史任务和设置，还需要拷贝数据库文件（见下方"数据迁移"）。

---

### 方式二：完整开发环境迁移

#### 第 1 步：新电脑安装前置软件

| 软件 | 说明 | 下载地址 |
|------|------|----------|
| **Node.js >= 18** | 推荐用 nvm-windows 管理多版本 | https://github.com/coreybutler/nvm-windows |
| **FFmpeg** | 视频处理核心依赖 | https://ffmpeg.org/download.html（确保加入系统 PATH） |
| **Git** | 版本管理 | https://git-scm.com/download/win |
| **GitHub CLI**（可选） | 用于克隆仓库 | https://cli.github.com/ |

#### 第 2 步：克隆仓库

```bash
git clone https://github.com/<你的用户名>/video-forge-desktop.git
cd video-forge-desktop
```

#### 第 3 步：安装依赖并启动

```bash
npm install
npm run dev
```

#### 第 4 步：配置 Provider

启动后进入 **设置** 页面，配置你的 Provider：

- **D-ID**：填写 API Key（必填）
- **Edge TTS**：免费，无需 API Key
- **Whisper ASR**：免费本地离线，无需 API Key

---

### 数据迁移

如果你需要将旧电脑的任务记录和设置迁移到新电脑：

#### 数据库文件位置

```
C:\Users\<用户名>\AppData\Roaming\videoforge\videoforge.db
```

#### 迁移步骤

1. 在旧电脑上找到上述 `.db` 文件
2. 拷贝到新电脑的相同路径
3. 重启应用即可看到历史任务

#### 输出文件位置

```
C:\Users\<用户名>\Documents\VideoForge\output\
```

如需保留已生成的视频，一并拷贝此目录。

---

## 项目结构

```
src/
├── main/                              # Electron 主进程
│   ├── index.ts                       # 入口（窗口创建 + IPC 注册）
│   ├── database.ts                    # SQLite 数据库封装
│   ├── task-queue.ts                  # p-queue 任务队列
│   ├── ProviderManager.ts             # Provider 单例注册中心
│   ├── interfaces/                    # Provider 接口定义
│   │   ├── ITalkingPhotoProvider.ts
│   │   ├── ITTSProvider.ts
│   │   └── IASRProvider.ts
│   ├── providers/                     # Provider 实现
│   │   ├── talkingphoto/DIDProvider.ts
│   │   ├── tts/EdgeTTSProvider.ts
│   │   └── asr/WhisperProvider.ts
│   ├── workers/                       # 任务执行器
│   │   ├── modeA.ts                   # 全自动：TTS → ASR → 数字人 → 字幕烧录
│   │   ├── modeB.ts                   # 已有素材：跳过 TTS
│   │   └── ffmpeg.ts                  # FFmpeg 封装
│   └── utils.ts                       # 工具函数
├── preload/
│   └── index.ts                       # contextBridge API
└── renderer/src/
    ├── main.tsx                        # React 入口
    ├── App.tsx                         # 路由布局
    ├── store/useStore.ts               # Zustand 状态管理
    ├── pages/                          # 页面组件
    └── components/                     # 通用组件
```

## 如何添加新的 Provider

添加新 Provider 只需三步：

### 1. 实现接口

以添加新的 TTS Provider 为例，创建 `src/main/providers/tts/NewTTSProvider.ts`：

```typescript
import { ITTSProvider, TTSConfig, TTSInput, TTSOutput } from '../../interfaces/ITTSProvider';
import { ProviderConfigSchema } from '../../interfaces/ITalkingPhotoProvider';

export class NewTTSProvider implements ITTSProvider {
  readonly id = 'newtts';
  readonly displayName = '新 TTS 引擎';
  readonly requiresApiKey = true;
  readonly supportsSsml = false;

  async validateConfig(config: TTSConfig): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }

  async synthesize(input: TTSInput): Promise<TTSOutput> {
    return { audioPath: '...', durationSeconds: 10, characterCount: 100 };
  }

  getConfigSchema(): ProviderConfigSchema {
    return {
      fields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true }
      ]
    };
  }
}
```

### 2. 注册 Provider

在 `src/main/index.ts` 的 `registerProviders()` 中添加一行：

```typescript
import { NewTTSProvider } from './providers/tts/NewTTSProvider';

function registerProviders(): void {
  const pm = ProviderManager.getInstance();
  pm.registerTTS(new EdgeTTSProvider());
  pm.registerTTS(new NewTTSProvider());  // 新增
}
```

### 3. 完成

启动应用，新 Provider 会自动出现在前端下拉框中，配置表单由 `getConfigSchema()` 动态生成。

## 内置 Provider

| 类型 | Provider | 说明 | 需要 API Key |
|------|----------|------|-------------|
| 数字人 | D-ID | 云端数字人服务 | 是 |
| TTS | Edge TTS | 免费微软语音合成 | 否 |
| ASR | Whisper | 本地离线语音识别 | 否 |

## 文件存储

- 用户输出：`~/Documents/VideoForge/output/{taskId}/`
- 临时文件：`~/Documents/VideoForge/temp/`
- 任务日志：`~/Documents/VideoForge/logs/`
- 数据库：`{userData}/videoforge.db`

## 数据库 Schema

**tasks 表**：id, mode, status, scriptText, avatarPath, audioPath, outputVideoPath, didVideoPath, subtitleSrtPath, talkingPhotoProviderId, ttsProviderId, asrProviderId, talkingPhotoConfig, ttsConfig, asrConfig, createdAt, updatedAt, errorMessage, logFilePath

**settings 表**：key TEXT PRIMARY KEY, value TEXT (JSON)
