import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Zap, Upload, Play, Plus, Minus, Wand2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import ProviderConfigForm from '../components/ProviderConfigForm';

type Mode = 'auto' | 'existing';

export default function Home() {
  const navigate = useNavigate();
  const { providers, settings, fetchProviders, fetchSettings, createTask } = useStore();

  const [mode, setMode] = useState<Mode>('auto');
  const [videoCount, setVideoCount] = useState(1);
  const [scripts, setScripts] = useState<string[]>(['']);
  const [avatarPath, setAvatarPath] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [talkingPhotoProviderId, setTalkingPhotoProviderId] = useState('');
  const [ttsProviderId, setTtsProviderId] = useState('');
  const [asrProviderId, setAsrProviderId] = useState('simple');
  const [talkingPhotoConfig, setTalkingPhotoConfig] = useState<Record<string, any>>({});
  const [ttsConfig, setTtsConfig] = useState<Record<string, any>>({});
  const [asrConfig, setAsrConfig] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (providers && !talkingPhotoProviderId) {
      if (providers.talkingPhoto.length > 0) setTalkingPhotoProviderId(providers.talkingPhoto[0].id);
      if (providers.tts.length > 0) setTtsProviderId(providers.tts[0].id);
    }
  }, [providers]);

  // Load saved config from settings
  useEffect(() => {
    if (settings && talkingPhotoProviderId) {
      const saved = settings[`provider:${talkingPhotoProviderId}`];
      if (saved) setTalkingPhotoConfig(saved);
    }
  }, [settings, talkingPhotoProviderId]);

  useEffect(() => {
    if (settings && ttsProviderId) {
      const saved = settings[`provider:${ttsProviderId}`];
      if (saved) setTtsConfig(saved);
    }
  }, [settings, ttsProviderId]);

  useEffect(() => {
    if (settings && asrProviderId && asrProviderId !== 'simple') {
      const saved = settings[`provider:${asrProviderId}`];
      if (saved) setAsrConfig(saved);
    }
  }, [settings, asrProviderId]);

  const handleVideoCountChange = (count: number) => {
    const clamped = Math.max(1, Math.min(10, count));
    setVideoCount(clamped);
    setScripts((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push('');
      return next.slice(0, clamped);
    });
  };

  const updateScript = (index: number, value: string) => {
    setScripts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAiGenerate = async (index: number) => {
    // Find default text AI service
    let services: any[] = [];
    try {
      services = await window.electronAPI.getAiServices();
    } catch {}
    const textService = services.find((s: any) => s.type === 'text' && s.is_default) || services.find((s: any) => s.type === 'text');
    if (!textService) {
      toast.error('请先在设置中配置文本生成 AI 服务');
      return;
    }

    setGeneratingIndex(index);
    try {
      const systemPrompt = '你是一个专业的短视频文案创作专家。根据用户的简要描述，生成一段适合数字人口播的短视频文案。文案要求：语言自然流畅、节奏感强、适合朗读、时长约30-60秒。直接输出文案内容，不要任何额外说明。';
      const userPrompt = scripts[index].trim() || '请生成一段有吸引力的短视频口播文案，主题不限';
      const text = await window.electronAPI.aiTextGenerate({
        serviceId: textService.id,
        prompt: userPrompt,
        systemPrompt
      });
      updateScript(index, text.trim());
      toast.success('文案已生成');
    } catch (err: any) {
      toast.error(`AI 生成失败: ${err.message}`);
    } finally {
      setGeneratingIndex(null);
    }
  };

  const handleOpenFile = async (field: 'avatar' | 'audio') => {
    const filters = field === 'avatar'
      ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]
      : [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }];
    const path = await window.electronAPI.openFile({ filters });
    if (path) {
      if (field === 'avatar') setAvatarPath(path);
      else setAudioPath(path);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'auto') {
      const emptyScripts = scripts.filter((s) => !s.trim());
      if (emptyScripts.length > 0) {
        toast.error(`请填写所有文案（第 ${scripts.findIndex((s) => !s.trim()) + 1} 条为空）`);
        return;
      }
    }
    if (!avatarPath) {
      toast.error('请上传头像照片');
      return;
    }
    if (mode === 'existing' && !audioPath) {
      toast.error('请上传音频文件');
      return;
    }
    if (mode === 'existing') {
      const emptyScripts = scripts.filter((s) => !s.trim());
      if (emptyScripts.length > 0) {
        toast.error(`请填写所有文案（第 ${scripts.findIndex((s) => !s.trim()) + 1} 条为空）`);
        return;
      }
    }
    if (!talkingPhotoProviderId) {
      toast.error('请选择数字人引擎');
      return;
    }

    setSubmitting(true);
    try {
      const taskIds: string[] = [];

      for (const script of scripts) {
        const taskId = await createTask({
          mode,
          scriptText: script,
          avatarPath,
          audioPath: mode === 'existing' ? audioPath : undefined,
          talkingPhotoProviderId,
          ttsProviderId: mode === 'auto' ? ttsProviderId : undefined,
          asrProviderId: asrProviderId !== 'simple' ? asrProviderId : undefined,
          talkingPhotoConfig,
          ttsConfig,
          asrConfig
        });
        taskIds.push(taskId);
      }

      toast.success(`已创建 ${taskIds.length} 个任务`);
      if (taskIds.length === 1) {
        navigate(`/task/${taskIds[0]}`);
      } else {
        navigate('/tasks');
      }
    } catch (err: any) {
      toast.error(`创建失败: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!providers) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Zap className="w-6 h-6" />
        创建任务
      </h2>

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setMode('auto')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            mode === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          模式 A · 全自动
        </button>
        <button
          onClick={() => setMode('existing')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            mode === 'existing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          模式 B · 已有素材
        </button>
      </div>

      {/* Video Count + Script Texts */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">生成数量</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVideoCountChange(videoCount - 1)}
                disabled={videoCount <= 1}
                className="w-8 h-8 rounded-md border border-input bg-background flex items-center justify-center text-sm hover:bg-accent disabled:opacity-40"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">{videoCount}</span>
              <button
                onClick={() => handleVideoCountChange(videoCount + 1)}
                disabled={videoCount >= 10}
                className="w-8 h-8 rounded-md border border-input bg-background flex items-center justify-center text-sm hover:bg-accent disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {scripts.map((script, index) => (
            <div key={index} className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                文案 {videoCount > 1 ? `${index + 1}` : ''}
              </label>
              <textarea
                value={script}
                onChange={(e) => updateScript(index, e.target.value)}
                rows={videoCount > 3 ? 3 : 5}
                placeholder={`输入第 ${index + 1} 条文案...`}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex items-center justify-end">
                <button
                  onClick={() => handleAiGenerate(index)}
                  disabled={generatingIndex !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
                >
                  <Wand2 className={`w-3.5 h-3.5 ${generatingIndex === index ? 'animate-spin' : ''}`} />
                  {generatingIndex === index ? '生成中...' : 'AI 生成'}
                </button>
              </div>
            </div>
          ))}
        </div>

      {/* Avatar Upload */}
      <div className="space-y-2">
        <label className="text-sm font-medium">头像照片</label>
        <div className="flex gap-2">
          <input
            value={avatarPath}
            readOnly
            placeholder="选择头像图片..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => handleOpenFile('avatar')}
            className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio Upload (Mode B only) */}
      {mode === 'existing' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">音频文件</label>
          <div className="flex gap-2">
            <input
              value={audioPath}
              readOnly
              placeholder="选择音频文件..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => handleOpenFile('audio')}
              className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TalkingPhoto Provider */}
        <div className="space-y-2">
          <label className="text-sm font-medium">数字人引擎</label>
          <select
            value={talkingPhotoProviderId}
            onChange={(e) => setTalkingPhotoProviderId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {providers.talkingPhoto.map((p: any) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        {/* TTS Provider (Mode A only) */}
        {mode === 'auto' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">TTS 引擎</label>
            <select
              value={ttsProviderId}
              onChange={(e) => setTtsProviderId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {providers.tts.map((p: any) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </div>
        )}

        {/* ASR Provider */}
        <div className="space-y-2">
          <label className="text-sm font-medium">字幕对齐</label>
          <select
            value={asrProviderId}
            onChange={(e) => setAsrProviderId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="simple">简单均分</option>
            {providers.asr.map((p: any) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Config Forms */}
      {talkingPhotoProviderId && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold">数字人引擎配置</h3>
          <ProviderConfigForm
            schema={providers.talkingPhoto.find((p: any) => p.id === talkingPhotoProviderId)?.configSchema}
            values={talkingPhotoConfig}
            onChange={setTalkingPhotoConfig}
            savedValues={settings[`provider:${talkingPhotoProviderId}`] || {}}
          />
        </div>
      )}

      {mode === 'auto' && ttsProviderId && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold">TTS 引擎配置</h3>
          <ProviderConfigForm
            schema={providers.tts.find((p: any) => p.id === ttsProviderId)?.configSchema}
            values={ttsConfig}
            onChange={setTtsConfig}
            savedValues={settings[`provider:${ttsProviderId}`] || {}}
          />
        </div>
      )}

      {asrProviderId && asrProviderId !== 'simple' && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold">ASR 引擎配置</h3>
          <ProviderConfigForm
            schema={providers.asr.find((p: any) => p.id === asrProviderId)?.configSchema}
            values={asrConfig}
            onChange={setAsrConfig}
            savedValues={settings[`provider:${asrProviderId}`] || {}}
          />
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        {submitting ? '提交中...' : `开始生成${videoCount > 1 ? `（${videoCount} 个任务）` : ''}`}
      </button>
    </div>
  );
}
