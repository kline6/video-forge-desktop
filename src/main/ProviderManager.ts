import { ITalkingPhotoProvider, TalkingPhotoInput, TalkingPhotoOutput } from './interfaces/ITalkingPhotoProvider';
import { ITTSProvider, TTSInput, TTSOutput } from './interfaces/ITTSProvider';
import { IASRProvider, ASRInput, ASROutput } from './interfaces/IASRProvider';

export class ProviderManager {
  private static instance: ProviderManager;

  private talkingPhotoProviders = new Map<string, ITalkingPhotoProvider>();
  private ttsProviders = new Map<string, ITTSProvider>();
  private asrProviders = new Map<string, IASRProvider>();

  private constructor() {}

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  registerTalkingPhoto(provider: ITalkingPhotoProvider): void {
    this.talkingPhotoProviders.set(provider.id, provider);
  }

  registerTTS(provider: ITTSProvider): void {
    this.ttsProviders.set(provider.id, provider);
  }

  registerASR(provider: IASRProvider): void {
    this.asrProviders.set(provider.id, provider);
  }

  getTalkingPhotoProviders(): ITalkingPhotoProvider[] {
    return Array.from(this.talkingPhotoProviders.values());
  }

  getTTSProviders(): ITTSProvider[] {
    return Array.from(this.ttsProviders.values());
  }

  getASRProviders(): IASRProvider[] {
    return Array.from(this.asrProviders.values());
  }

  getTalkingPhotoProvider(id: string): ITalkingPhotoProvider | undefined {
    return this.talkingPhotoProviders.get(id);
  }

  getTTSProvider(id: string): ITTSProvider | undefined {
    return this.ttsProviders.get(id);
  }

  getASRProvider(id: string): IASRProvider | undefined {
    return this.asrProviders.get(id);
  }

  async callTalkingPhoto(providerId: string, input: TalkingPhotoInput): Promise<TalkingPhotoOutput> {
    const provider = this.talkingPhotoProviders.get(providerId);
    if (!provider) throw new Error(`TalkingPhoto provider not found: ${providerId}`);
    return provider.generate(input);
  }

  async callTTS(providerId: string, input: TTSInput): Promise<TTSOutput> {
    const provider = this.ttsProviders.get(providerId);
    if (!provider) throw new Error(`TTS provider not found: ${providerId}`);
    return provider.synthesize(input);
  }

  async callASR(providerId: string, input: ASRInput): Promise<ASROutput> {
    const provider = this.asrProviders.get(providerId);
    if (!provider) throw new Error(`ASR provider not found: ${providerId}`);
    return provider.transcribe(input);
  }

  getProviderSummary(): any {
    return {
      talkingPhoto: this.getTalkingPhotoProviders().map((p) => ({
        id: p.id,
        displayName: p.displayName,
        requiresApiKey: p.requiresApiKey,
        configSchema: p.getConfigSchema()
      })),
      tts: this.getTTSProviders().map((p) => ({
        id: p.id,
        displayName: p.displayName,
        requiresApiKey: p.requiresApiKey,
        supportsSsml: p.supportsSsml,
        configSchema: p.getConfigSchema()
      })),
      asr: this.getASRProviders().map((p) => ({
        id: p.id,
        displayName: p.displayName,
        requiresApiKey: p.requiresApiKey,
        supportsAlignment: p.supportsAlignment,
        configSchema: p.getConfigSchema()
      }))
    };
  }
}
