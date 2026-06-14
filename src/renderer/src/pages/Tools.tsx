import { useState, useEffect, Component, ReactNode } from 'react';
import { toast } from 'sonner';
import { Mic, Image, Layers, Upload, Play, Loader2, Wand2, RefreshCw, Key, ExternalLink } from 'lucide-react';

type ToolTab = 'voice-clone' | 'text-to-image' | 'image-to-image';

interface AiService {
  id: string;
  name: string;
  type: string;
  api_key: string;
  endpoint: string;
  model: string;
  models_list: string;
  is_default: number;
}

// Error boundary to catch rendering crashes
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 rounded-lg border border-destructive bg-destructive/10 text-destructive">
          <p className="font-medium">Render error</p>
          <p className="text-sm mt-1">{this.state.error}</p>
          <button onClick={() => this.setState({ error: null })} className="mt-3 px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Tools() {
  const [activeTool, setActiveTool] = useState<ToolTab>('voice-clone');
  const [aiServices, setAiServices] = useState<AiService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { loadServices(); }, []);
  useEffect(() => {
    const handler = () => loadServices();
    window.addEventListener('ai-services-updated', handler);
    return () => window.removeEventListener('ai-services-updated', handler);
  }, []);

  const loadServices = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const services = await window.electronAPI.getAiServices();
      setAiServices(Array.isArray(services) ? services : []);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load services');
      setAiServices([]);
    } finally {
      setLoading(false);
    }
  };

  const getServicesByType = (type: string) => aiServices.filter((s) => s.type === type);
  const getDefaultService = (type: string) => {
    const services = getServicesByType(type);
    return services.find((s) => s.is_default) || services[0] || null;
  };

  const tools: { id: ToolTab; label: string; icon: any }[] = [
    { id: 'voice-clone', label: 'Voice', icon: Mic },
    { id: 'text-to-image', label: 'Text2Img', icon: Image },
    { id: 'image-to-image', label: 'Remix', icon: Layers }
  ];

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="w-6 h-6" />
            Tools
          </h2>
          <button onClick={loadServices} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {loadError && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {loadError}
          </div>
        )}

        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                activeTool === tool.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tool.icon className="w-4 h-4" />
              {tool.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <>
            {activeTool === 'voice-clone' && <VoiceCloneTool services={getServicesByType('voice')} defaultService={getDefaultService('voice')} />}
            {activeTool === 'text-to-image' && <TextToImageTool services={getServicesByType('image')} defaultService={getDefaultService('image')} />}
            {activeTool === 'image-to-image' && <ImageToImageTool services={getServicesByType('image')} defaultService={getDefaultService('image')} />}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

// ==================== Voice Synthesis ====================
function VoiceCloneTool({ services, defaultService }: { services: AiService[]; defaultService: AiService | null }) {
  const [mode, setMode] = useState<'tts' | 'clone'>('tts');
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voices, setVoices] = useState<{ voiceId: string; name: string; category: string }[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [resultPath, setResultPath] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(defaultService?.id || '');

  // Clone state
  const [cloneName, setCloneName] = useState('');
  const [cloneDesc, setCloneDesc] = useState('');
  const [audioPaths, setAudioPaths] = useState<string[]>([]);
  const [cloning, setCloning] = useState(false);
  const [quickSetupKey, setQuickSetupKey] = useState('');
  const [quickSetupType, setQuickSetupType] = useState<'xiaomi' | 'elevenlabs'>('xiaomi');
  const [quickSetupEndpoint, setQuickSetupEndpoint] = useState('https://token-plan-cn.xiaomimimo.com/v1');
  const [settingUp, setSettingUp] = useState(false);

  const handleQuickSetup = async () => {
    if (!quickSetupKey.trim()) { toast.error('Please enter your API key'); return; }
    setSettingUp(true);
    try {
      const isElevenLabs = quickSetupType === 'elevenlabs';
      await window.electronAPI.saveAiService({
        name: isElevenLabs ? 'ElevenLabs' : 'Xiaomi TTS',
        type: 'voice',
        apiKey: quickSetupKey,
        endpoint: quickSetupEndpoint,
        model: isElevenLabs ? 'eleven_multilingual_v2' : 'tts-1',
        modelsList: [],
        isDefault: true,
        protocol: 'chat_completions',
        userAgent: 'VideoForge/1.0',
        enabled: true
      });
      toast.success(`${isElevenLabs ? 'ElevenLabs' : 'Xiaomi'} configured!`);
      const allServices = await window.electronAPI.getAiServices();
      const voiceServices = allServices.filter((s: any) => s.type === 'voice');
      if (voiceServices.length > 0) setSelectedServiceId(voiceServices[0].id);
      window.dispatchEvent(new Event('ai-services-updated'));
    } catch (err: any) {
      toast.error(`Setup failed: ${err.message}`);
    } finally {
      setSettingUp(false);
    }
  };

  const handleLoadVoices = async () => {
    if (!selectedServiceId) { toast.error('Please select a voice service'); return; }
    setLoadingVoices(true);
    try {
      const list = await window.electronAPI.aiListVoices({ serviceId: selectedServiceId });
      setVoices(list);
      if (list.length > 0 && !voiceId) setVoiceId(list[0].voiceId);
      toast.success(`Loaded ${list.length} voices`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleSynthesize = async () => {
    if (!selectedServiceId) { toast.error('Please select a service'); return; }
    if (!voiceId.trim()) { toast.error('Please select or enter a voice ID'); return; }
    if (!text.trim()) { toast.error('Please enter text'); return; }
    setSynthesizing(true);
    try {
      const path = await window.electronAPI.aiVoiceSynthesize({ serviceId: selectedServiceId, voiceId, text });
      setResultPath(path);
      toast.success('Voice synthesis complete');
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSynthesizing(false);
    }
  };

  const handleAddAudio = async () => {
    const path = await window.electronAPI.openFile({
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
    });
    if (path) setAudioPaths((prev) => [...prev, path]);
  };

  const handleClone = async () => {
    if (!selectedServiceId) { toast.error('Please select a service'); return; }
    if (!cloneName.trim()) { toast.error('Please enter a voice name'); return; }
    if (audioPaths.length === 0) { toast.error('Please upload at least one audio sample'); return; }
    setCloning(true);
    try {
      const result = await window.electronAPI.aiVoiceClone({
        serviceId: selectedServiceId, name: cloneName, description: cloneDesc, audioPaths
      });
      setVoiceId(result.voiceId);
      setMode('tts');
      toast.success(`Voice "${result.name}" cloned! Switched to TTS mode.`);
    } catch (err: any) {
      toast.error(`Clone failed: ${err.message}`);
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="p-6 rounded-lg border border-border bg-card space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mic className="w-5 h-5" /> Voice
        </h3>
        <div className="flex gap-1 p-0.5 bg-muted rounded-md text-xs">
          <button onClick={() => setMode('tts')} className={`px-3 py-1 rounded ${mode === 'tts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>TTS</button>
          <button onClick={() => setMode('clone')} className={`px-3 py-1 rounded ${mode === 'clone' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Clone</button>
        </div>
      </div>

      {/* Service selector (shared) */}
      {services.length > 0 ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Service</label>
          <select value={selectedServiceId} onChange={(e) => { setSelectedServiceId(e.target.value); setVoices([]); setVoiceId(''); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select service</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-border bg-muted/50 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Key className="w-4 h-4" />
            Quick Setup — Voice Service
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setQuickSetupType('xiaomi'); setQuickSetupEndpoint('https://token-plan-cn.xiaomimimo.com/v1'); }}
              className={`flex-1 px-3 py-2 rounded-md border text-sm text-center transition-all ${quickSetupType === 'xiaomi' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-muted-foreground/30'}`}>
              Xiaomi TTS
            </button>
            <button onClick={() => { setQuickSetupType('elevenlabs'); setQuickSetupEndpoint('https://api.elevenlabs.io'); }}
              className={`flex-1 px-3 py-2 rounded-md border text-sm text-center transition-all ${quickSetupType === 'elevenlabs' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-muted-foreground/30'}`}>
              ElevenLabs
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">API Endpoint</label>
            <input value={quickSetupEndpoint} onChange={(e) => setQuickSetupEndpoint(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
          </div>
          <div className="flex gap-2">
            <input type="password" value={quickSetupKey} onChange={(e) => setQuickSetupKey(e.target.value)}
              placeholder="API Key..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
            <button onClick={handleQuickSetup} disabled={settingUp}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {settingUp ? 'Setting up...' : 'Setup'}
            </button>
          </div>
        </div>
      )}

      {/* === TTS Mode === */}
      {mode === 'tts' && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Voice</label>
              <button onClick={handleLoadVoices} disabled={loadingVoices || !selectedServiceId}
                className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${loadingVoices ? 'animate-spin' : ''}`} />
                {loadingVoices ? 'Loading...' : 'Fetch voices'}
              </button>
            </div>
            {voices.length > 0 ? (
              <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {voices.map((v) => <option key={v.voiceId} value={v.voiceId}>{v.name} ({v.category})</option>)}
              </select>
            ) : (
              <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
                placeholder="Voice ID (click Fetch voices or paste manually)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
              placeholder="Enter text to synthesize..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>

          <button onClick={handleSynthesize} disabled={synthesizing || !selectedServiceId || !voiceId}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {synthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {synthesizing ? 'Synthesizing...' : 'Generate Speech'}
          </button>

          {resultPath && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">Result</p>
              <audio controls src={`file://${resultPath}`} className="w-full" />
            </div>
          )}
        </>
      )}

      {/* === Clone Mode === */}
      {mode === 'clone' && (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Voice Name</label>
            <input value={cloneName} onChange={(e) => setCloneName(e.target.value)}
              placeholder="Name for the cloned voice"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description (optional)</label>
            <input value={cloneDesc} onChange={(e) => setCloneDesc(e.target.value)}
              placeholder="Describe the voice characteristics"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Audio Samples</label>
              <button onClick={handleAddAudio} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Upload className="w-3 h-3" /> Add Audio
              </button>
            </div>
            {audioPaths.length > 0 && (
              <div className="space-y-1">
                {audioPaths.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded">
                    <span className="truncate">{p.split(/[\\/]/).pop()}</span>
                    <button onClick={() => setAudioPaths((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-destructive hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleClone} disabled={cloning || !selectedServiceId}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {cloning ? 'Cloning...' : 'Clone Voice'}
          </button>
        </>
      )}
    </div>
  );
}

// ==================== 文生图 ====================
function TextToImageTool({ services, defaultService }: { services: AiService[]; defaultService: AiService | null }) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [generating, setGenerating] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(defaultService?.id || '');

  const handleGenerate = async () => {
    if (!selectedServiceId) { toast.error('Please select an image service'); return; }
    if (!prompt.trim()) { toast.error('Please enter image description'); return; }

    setGenerating(true);
    setImageUrls([]);
    try {
      const urls = await window.electronAPI.aiImageGenerate({
        serviceId: selectedServiceId,
        prompt,
        size
      });
      setImageUrls(urls);
      if (urls.length > 0) toast.success('Image generated');
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 rounded-lg border border-border bg-card space-y-5">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Image className="w-5 h-5" />
        Text to Image
      </h3>

      {services.length > 0 ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Image Service</label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} - {s.model}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
          Please add an <strong>Image</strong> service in <strong>Settings → AI Services</strong> first.
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Image Description</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe the image you want to generate..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Image Size</label>
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="1024x1024">1024x1024 (Square)</option>
          <option value="1792x1024">1792x1024 (Landscape)</option>
          <option value="1024x1792">1024x1792 (Portrait)</option>
          <option value="512x512">512x512 (Small)</option>
        </select>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || !selectedServiceId}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {generating ? 'Generating...' : 'Generate Image'}
      </button>

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {imageUrls.map((url, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-border">
              <img src={url} alt={`Generated ${i + 1}`} className="w-full h-auto" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Image Remix ====================
function ImageToImageTool({ services, defaultService }: { services: AiService[]; defaultService: AiService | null }) {
  const [prompt, setPrompt] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(defaultService?.id || '');

  const handleOpenImage = async () => {
    const path = await window.electronAPI.openFile({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (path) setImagePath(path);
  };

  const handleGenerate = async () => {
    if (!selectedServiceId) { toast.error('Please select an image service'); return; }
    if (!prompt.trim()) { toast.error('Please enter a description'); return; }
    setGenerating(true);
    setImageUrls([]);
    try {
      const urls = await window.electronAPI.aiImageEdit({
        serviceId: selectedServiceId,
        prompt,
        imagePath: imagePath || 'none'
      });
      setImageUrls(urls);
      if (urls.length > 0) toast.success('Image generated');
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 rounded-lg border border-border bg-card space-y-5">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Layers className="w-5 h-5" />
        Image Remix
      </h3>
      <p className="text-xs text-muted-foreground">Describe the style or changes you want. A reference image is optional.</p>

      {services.length > 0 ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Image Service</label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} - {s.model}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
          Please add an <strong>Image</strong> service in <strong>Settings → AI Services</strong> first.
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Reference Image (optional)</label>
        <div className="flex gap-2">
          <input
            value={imagePath}
            readOnly
            placeholder="Optional reference image..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button onClick={handleOpenImage} className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the style or changes you want..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || !selectedServiceId}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {generating ? 'Generating...' : 'Generate Image'}
      </button>

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {imageUrls.map((url, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-border">
              <img src={url} alt={`Generated ${i + 1}`} className="w-full h-auto" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
