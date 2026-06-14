import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon, Save, Plus, Trash2, RefreshCw,
  Sparkles, Image, Mic, ChevronDown, ChevronRight, Copy,
  Check, Eye, EyeOff, Server, Key, Globe, Cpu, FileText,
  Shield, MoreHorizontal, Star, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useStore } from '../store/useStore';
import ProviderConfigForm from '../components/ProviderConfigForm';

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryKey = 'talkingPhoto' | 'tts' | 'asr';
type AiServiceType = 'text' | 'image' | 'voice';
type SettingsTab = 'providers' | 'ai';

interface AiService {
  id?: string;
  name: string;
  type: AiServiceType;
  apiKey: string;
  endpoint: string;
  model: string;
  modelsList: string[];
  isDefault: boolean;
  protocol: 'chat_completions' | 'responses';
  userAgent: string;
  enabled: boolean;
  createdAt?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const categoryLabels: Record<CategoryKey, string> = {
  talkingPhoto: '数字人引擎',
  tts: 'TTS 语音合成',
  asr: 'ASR 语音识别'
};

const serviceTypeLabels: Record<AiServiceType, string> = {
  text: '文本生成',
  image: '图像生成',
  voice: '语音克隆'
};

const serviceTypeIcons: Record<AiServiceType, any> = {
  text: Sparkles,
  image: Image,
  voice: Mic
};

const defaultEndpoints: Record<AiServiceType, string> = {
  text: 'https://api.openai.com',
  image: 'https://api.openai.com',
  voice: 'https://api.elevenlabs.io'
};

const protocolOptions = [
  { value: 'chat_completions', label: 'Chat Completions', desc: '/v1/chat/completions' },
  { value: 'responses', label: 'Responses API', desc: '/v1/responses' }
];

// ─── Preset Templates ────────────────────────────────────────────────────────

const presets: Record<string, Partial<AiService>> = {
  openai: { name: 'OpenAI', endpoint: 'https://api.openai.com', protocol: 'chat_completions' },
  claude: { name: 'Claude (Anthropic)', endpoint: 'https://api.anthropic.com', protocol: 'chat_completions' },
  deepseek: { name: 'DeepSeek', endpoint: 'https://api.deepseek.com', protocol: 'chat_completions' },
  groq: { name: 'Groq', endpoint: 'https://api.groq.com/openai', protocol: 'chat_completions' },
  together: { name: 'Together AI', endpoint: 'https://api.together.xyz', protocol: 'chat_completions' },
  siliconflow: { name: 'SiliconFlow', endpoint: 'https://api.siliconflow.cn', protocol: 'chat_completions' },
  elevenlabs: { name: 'ElevenLabs', type: 'voice' as AiServiceType, endpoint: 'https://api.elevenlabs.io', protocol: 'chat_completions' },
  xiaomi: { name: 'Xiaomi TTS', type: 'voice' as AiServiceType, endpoint: 'https://api.xiaomi.com', protocol: 'chat_completions' },
  custom: { name: 'Custom Service', endpoint: '', protocol: 'chat_completions' }
};

// ─── Config Preview Generator ────────────────────────────────────────────────

function generateConfigPreview(service: AiService): string {
  const base = service.endpoint.replace(/\/+$/, '').replace(/\/v1$/, '');
  return `# ${service.name} 配置预览
# 此配置在切换到此供应商时生效

[provider]
name    = "${service.name}"
type    = "${service.type}"
enabled = ${service.enabled}
default = ${service.isDefault}

[provider.connection]
base_url   = "${base}"
protocol   = "${service.protocol}"
model      = "${service.model}"
user_agent = "${service.userAgent || 'VideoForge/1.0'}"

# 已获取的模型列表 (${service.modelsList.length} 个)
${service.modelsList.length > 0
  ? service.modelsList.map(m => `#   - ${m}`).join('\n')
  : '#   (尚未获取，点击"从上游获取"加载)'
}`;
}

function generateAuthPreview(service: AiService): string {
  return JSON.stringify({
    provider: service.name,
    api_key: service.apiKey ? `${service.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, service.apiKey.length - 12))}${service.apiKey.slice(-4)}` : '(未设置)',
    endpoint: service.endpoint.replace(/\/+$/, '').replace(/\/v1$/, ''),
    model: service.model || '(未选择)',
    protocol: service.protocol
  }, null, 2);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { providers, settings, fetchProviders, fetchSettings, saveSettings } = useStore();

  // Provider settings state
  const [selectedProvider, setSelectedProvider] = useState<{ category: CategoryKey; id: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  // AI Services state
  const [aiServices, setAiServices] = useState<any[]>([]);
  const [editingService, setEditingService] = useState<AiService | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');

  // UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    connection: true,
    model: true,
    advanced: false,
    preview: false
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProviders();
    fetchSettings();
    loadAiServices();
  }, []);

  useEffect(() => {
    if (selectedProvider && settings) {
      const key = `provider:${selectedProvider.id}`;
      setEditValues(settings[key] || {});
    }
  }, [selectedProvider, settings]);

  // ─── Data Loading ────────────────────────────────────────────────────────

  const loadAiServices = async () => {
    try {
      const services = await window.electronAPI.getAiServices();
      setAiServices(services);
    } catch {}
  };

  // ─── Provider Settings Handlers ──────────────────────────────────────────

  const handleSaveProviderConfig = async () => {
    if (!selectedProvider) return;
    const key = `provider:${selectedProvider.id}`;
    try {
      await saveSettings(key, editValues);
      toast.success('Provider 配置已保存');
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    }
  };

  // ─── AI Service Handlers ─────────────────────────────────────────────────

  const parseService = (raw: any): AiService => ({
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 'text',
    apiKey: raw.api_key || raw.apiKey || '',
    endpoint: raw.endpoint || '',
    model: raw.model || '',
    modelsList: raw.models_list ? (typeof raw.models_list === 'string' ? JSON.parse(raw.models_list) : raw.models_list) : [],
    isDefault: !!raw.is_default || !!raw.isDefault,
    protocol: raw.protocol || 'chat_completions',
    userAgent: raw.user_agent || raw.userAgent || 'VideoForge/1.0',
    enabled: raw.enabled !== false,
    createdAt: raw.created_at || raw.createdAt
  });

  const handleCreateFromPreset = (presetKey: string) => {
    const preset = presets[presetKey];
    setEditingService({
      name: preset.name || '',
      type: preset.type || 'text',
      apiKey: '',
      endpoint: preset.endpoint || '',
      model: '',
      modelsList: [],
      isDefault: false,
      protocol: (preset.protocol as any) || 'chat_completions',
      userAgent: 'VideoForge/1.0',
      enabled: true
    });
    setIsCreating(true);
    setShowPresetMenu(false);
  };

  const handleCreateBlank = (type: AiServiceType) => {
    setEditingService({
      name: '',
      type,
      apiKey: '',
      endpoint: defaultEndpoints[type],
      model: '',
      modelsList: [],
      isDefault: false,
      protocol: 'chat_completions',
      userAgent: 'VideoForge/1.0',
      enabled: true
    });
    setIsCreating(true);
  };

  const handleSaveService = async () => {
    if (!editingService) return;
    if (!editingService.name.trim()) { toast.error('请填写服务名称'); return; }

    try {
      await window.electronAPI.saveAiService({
        id: editingService.id,
        name: editingService.name,
        type: editingService.type,
        apiKey: editingService.apiKey,
        endpoint: editingService.endpoint,
        model: editingService.model,
        modelsList: editingService.modelsList,
        isDefault: editingService.isDefault,
        protocol: editingService.protocol,
        userAgent: editingService.userAgent,
        enabled: editingService.enabled,
        createdAt: editingService.createdAt
      });
      toast.success(isCreating ? '服务已创建' : '配置已保存并切换');
      if (isCreating) {
        setEditingService(null);
        setIsCreating(false);
      }
      await loadAiServices();
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await window.electronAPI.deleteAiService(id);
      toast.success('服务已删除');
      if (editingService?.id === id) { setEditingService(null); setIsCreating(false); }
      await loadAiServices();
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  const handleSetDefault = async (service: any) => {
    const parsed = parseService(service);
    parsed.isDefault = true;
    try {
      await window.electronAPI.saveAiService(parsed);
      toast.success(`已将 ${parsed.name} 设为默认`);
      await loadAiServices();
    } catch (err: any) {
      toast.error(`设置失败: ${err.message}`);
    }
  };

  const handleToggleEnabled = async (service: any) => {
    const parsed = parseService(service);
    parsed.enabled = !parsed.enabled;
    try {
      await window.electronAPI.saveAiService(parsed);
      await loadAiServices();
    } catch {}
  };

  const handleFetchModels = async () => {
    if (!editingService?.apiKey || !editingService?.endpoint) {
      toast.error('请先填写 API Key 和 Base URL');
      return;
    }
    setFetchingModels(true);
    try {
      const result = await window.electronAPI.fetchAiModels({
        apiKey: editingService.apiKey,
        endpoint: editingService.endpoint
      });
      if (result.success && result.models) {
        setEditingService(prev => prev ? { ...prev, modelsList: result.models! } : prev);
        toast.success(`获取到 ${result.models.length} 个模型`);
      } else {
        toast.error(`获取失败: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`获取失败: ${err.message}`);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateEditing = (patch: Partial<AiService>) => {
    setEditingService(prev => prev ? { ...prev, ...patch } : prev);
  };

  // ─── Computed ────────────────────────────────────────────────────────────

  const servicesByType = useMemo(() => {
    const grouped: Record<AiServiceType, any[]> = { text: [], image: [], voice: [] };
    aiServices.forEach((s: any) => {
      const t = s.type as AiServiceType;
      if (grouped[t]) grouped[t].push(s);
    });
    return grouped;
  }, [aiServices]);

  const configPreview = useMemo(() => {
    return editingService ? generateConfigPreview(editingService) : '';
  }, [editingService]);

  const authPreview = useMemo(() => {
    return editingService ? generateAuthPreview(editingService) : '';
  }, [editingService]);

  // ─── Render Helpers ──────────────────────────────────────────────────────

  if (!providers) return <div className="text-muted-foreground p-6">加载中...</div>;

  const providerMap: Record<CategoryKey, any[]> = {
    talkingPhoto: providers.talkingPhoto,
    tts: providers.tts,
    asr: providers.asr
  };

  const currentSchema = selectedProvider
    ? providerMap[selectedProvider.category]?.find((p: any) => p.id === selectedProvider.id)?.configSchema
    : null;

  // ─── Section Header Component ────────────────────────────────────────────

  const SectionHeader = ({ icon: Icon, label, sectionKey, count }: { icon: any; label: string; sectionKey: string; count?: number }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center gap-2 w-full text-left py-2 group"
    >
      {expandedSections[sectionKey] ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground ml-auto">{count}</span>}
    </button>
  );

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          设置
        </h2>
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          {([['providers', 'Provider 配置'], ['ai', 'AI 服务']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as SettingsTab)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Provider Configuration Tab ═══ */}
      {activeTab === 'providers' && (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-56 shrink-0 space-y-4 overflow-auto pr-2">
            {(Object.keys(categoryLabels) as CategoryKey[]).map((cat) => (
              <div key={cat} className="space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  {categoryLabels[cat]}
                </h3>
                {providerMap[cat]?.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvider({ category: cat, id: p.id })}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                      selectedProvider?.id === p.id
                        ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="block truncate">{p.displayName}</span>
                    {p.requiresApiKey && (
                      <span className="block text-[10px] opacity-50 mt-0.5">需要 API Key</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto">
            {selectedProvider && currentSchema ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {providerMap[selectedProvider.category]?.find((p: any) => p.id === selectedProvider.id)?.displayName}
                  </h3>
                  <button
                    onClick={handleSaveProviderConfig}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                  >
                    <Save className="w-4 h-4" />
                    保存配置
                  </button>
                </div>
                <div className="p-5 rounded-lg border border-border bg-card">
                  <ProviderConfigForm
                    schema={currentSchema}
                    values={editValues}
                    onChange={setEditValues}
                    savedValues={settings[`provider:${selectedProvider.id}`] || {}}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                <Server className="w-8 h-8 opacity-30" />
                <p className="text-sm">选择左侧 Provider 查看和编辑配置</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ AI Services Tab ═══ */}
      {activeTab === 'ai' && (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* ── Sidebar: Service List ── */}
          <div className="w-64 shrink-0 overflow-auto pr-2 space-y-4">
            {/* Quick Add */}
            <div className="relative">
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-muted-foreground/30 rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加 AI 服务
              </button>
              {showPresetMenu && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="p-1.5">
                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">快速添加</p>
                    {Object.entries(presets).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => handleCreateFromPreset(key)}
                        className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border p-1.5">
                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">按类型添加</p>
                    {(['text', 'image', 'voice'] as AiServiceType[]).map((type) => {
                      const Icon = serviceTypeIcons[type];
                      return (
                        <button
                          key={type}
                          onClick={() => handleCreateBlank(type)}
                          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2 transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {serviceTypeLabels[type]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Service Groups */}
            {(['text', 'image', 'voice'] as AiServiceType[]).map((type) => {
              const Icon = serviceTypeIcons[type];
              const services = servicesByType[type];
              return (
                <div key={type} className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {serviceTypeLabels[type]}
                    <span className="ml-auto text-[10px] font-normal">{services.length}</span>
                  </h3>
                  {services.map((s: any) => {
                    const parsed = parseService(s);
                    const isActive = editingService?.id === parsed.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => { setEditingService(parsed); setIsCreating(false); }}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-all ${
                          isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!parsed.enabled && <span className="text-[10px] text-muted-foreground">(已禁用)</span>}
                            {parsed.isDefault && <Star className="w-3 h-3 text-yellow-500 shrink-0" />}
                            <span className="truncate font-medium">{parsed.name}</span>
                          </div>
                          <span className={`block text-[10px] truncate mt-0.5 ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>
                            {parsed.model || parsed.endpoint || '未配置'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleEnabled(s); }}
                            className="p-0.5 rounded hover:bg-black/10"
                            title={parsed.enabled ? '禁用' : '启用'}
                          >
                            {parsed.enabled ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteService(s.id); }}
                            className="p-0.5 rounded hover:bg-destructive/20"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {services.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-3 py-1.5 italic">暂无配置</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Main: Service Editor ── */}
          <div className="flex-1 overflow-auto">
            {editingService ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{isCreating ? '添加 AI 服务' : editingService.name}</h3>
                    {!isCreating && (
                      <button
                        onClick={() => handleSetDefault(editingService)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          editingService.isDefault
                            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                            : 'border-muted-foreground/20 text-muted-foreground hover:border-yellow-400 hover:text-yellow-600'
                        }`}
                      >
                        <Star className="w-3 h-3" />
                        {editingService.isDefault ? '默认' : '设为默认'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveService}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                    >
                      <Save className="w-4 h-4" />
                      {isCreating ? '创建' : '保存并切换'}
                    </button>
                    {isCreating && (
                      <button
                        onClick={() => { setEditingService(null); setIsCreating(false); }}
                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Section: Basic Info ── */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">名称</label>
                        <input
                          value={editingService.name}
                          onChange={(e) => updateEditing({ name: e.target.value })}
                          placeholder="服务名称"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">接入类型</label>
                        <select
                          value={editingService.type}
                          onChange={(e) => updateEditing({ type: e.target.value as AiServiceType })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {Object.entries(serviceTypeLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingService.enabled}
                        onChange={(e) => updateEditing({ enabled: e.target.checked })}
                        className="rounded"
                      />
                      启用此服务
                    </label>
                  </div>
                </div>

                {/* ── Section: Connection ── */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-4 pt-3 pb-1">
                    <SectionHeader icon={Globe} label="连接配置" sectionKey="connection" />
                  </div>
                  {expandedSections.connection && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Server className="w-3 h-3" />
                          Base URL
                        </label>
                        <input
                          value={editingService.endpoint}
                          onChange={(e) => updateEditing({ endpoint: e.target.value })}
                          placeholder="https://api.openai.com"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Key className="w-3 h-3" />
                          API Key
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={editingService.apiKey}
                            onChange={(e) => updateEditing({ apiKey: e.target.value })}
                            placeholder="sk-..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Cpu className="w-3 h-3" />
                          上游协议
                        </label>
                        <div className="flex gap-2">
                          {protocolOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updateEditing({ protocol: opt.value as any })}
                              className={`flex-1 px-3 py-2.5 rounded-md border text-sm text-left transition-all ${
                                editingService.protocol === opt.value
                                  ? 'border-primary bg-primary/5 text-primary font-medium'
                                  : 'border-border hover:border-muted-foreground/30'
                              }`}
                            >
                              <span className="block">{opt.label}</span>
                              <span className="block text-[10px] text-muted-foreground mt-0.5 font-mono">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User-Agent</label>
                        <input
                          value={editingService.userAgent}
                          onChange={(e) => updateEditing({ userAgent: e.target.value })}
                          placeholder="VideoForge/1.0"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section: Model ── */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-4 pt-3 pb-1">
                    <SectionHeader icon={Cpu} label="模型列表" sectionKey="model" count={editingService.modelsList.length || undefined} />
                  </div>
                  {expandedSections.model && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleFetchModels}
                          disabled={fetchingModels}
                          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${fetchingModels ? 'animate-spin' : ''}`} />
                          {fetchingModels ? '获取中...' : '从上游获取'}
                        </button>
                        {editingService.modelsList.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            已获取 {editingService.modelsList.length} 个模型
                          </span>
                        )}
                      </div>

                      {editingService.modelsList.length > 0 ? (
                        <select
                          value={editingService.model}
                          onChange={(e) => updateEditing({ model: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">-- 请选择模型 --</option>
                          {editingService.modelsList.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">手动输入模型名称</label>
                          <input
                            value={editingService.model}
                            onChange={(e) => updateEditing({ model: e.target.value })}
                            placeholder="gpt-4o / deepseek-chat / ..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      )}

                      <p className="text-[11px] text-muted-foreground">
                        点击"从上游获取"自动拉取此服务的可用模型列表，或手动输入模型名称。
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Section: Advanced ── */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-4 pt-3 pb-1">
                    <SectionHeader icon={MoreHorizontal} label="更多选项" sectionKey="advanced" />
                  </div>
                  {expandedSections.advanced && (
                    <div className="px-4 pb-4 space-y-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingService.isDefault}
                          onChange={(e) => updateEditing({ isDefault: e.target.checked })}
                          className="rounded"
                        />
                        设为当前类型的默认服务
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        设为默认后，文案生成等功能会优先使用此服务。
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Section: Config Preview ── */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-4 pt-3 pb-1">
                    <SectionHeader icon={FileText} label="配置预览" sectionKey="preview" />
                  </div>
                  {expandedSections.preview && (
                    <div className="px-4 pb-4 space-y-4">
                      <p className="text-[11px] text-muted-foreground">
                        切换到此供应商时会写入的配置预览；配置变化会立即反映。
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">config.toml 预览</span>
                          <button
                            onClick={() => handleCopy(configPreview, 'config')}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === 'config' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copiedField === 'config' ? '已复制' : '复制'}
                          </button>
                        </div>
                        <pre className="p-3 rounded-md bg-muted/50 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-48 border border-border">
                          {configPreview}
                        </pre>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">auth.json</span>
                          <button
                            onClick={() => handleCopy(authPreview, 'auth')}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === 'auth' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copiedField === 'auth' ? '已复制' : '复制'}
                          </button>
                        </div>
                        <pre className="p-3 rounded-md bg-muted/50 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-32 border border-border">
                          {authPreview}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="w-7 h-7 opacity-30" />
                </div>
                <p className="text-sm">选择或添加一个 AI 服务进行配置</p>
                <p className="text-xs text-muted-foreground/60">支持 OpenAI、Claude、DeepSeek 等兼容接口</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
