import { ProviderConfigSchema } from './ITalkingPhotoProvider';

export interface TTSConfig {
  apiKey?: string;
  voiceName?: string;
  speed?: number;
  pitch?: number;
  [key: string]: any;
}

export interface TTSInput {
  text: string;
  config: TTSConfig;
  onProgress?: (progress: number) => void;
}

export interface TTSOutput {
  audioPath: string;
  durationSeconds: number;
  characterCount: number;
}

export interface ITTSProvider {
  readonly id: string;
  readonly displayName: string;
  readonly requiresApiKey: boolean;
  readonly supportsSsml: boolean;

  validateConfig(config: TTSConfig): Promise<{ valid: boolean; errors: string[] }>;
  synthesize(input: TTSInput): Promise<TTSOutput>;
  getConfigSchema(): ProviderConfigSchema;
}
