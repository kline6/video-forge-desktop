import { ProviderConfigSchema } from './ITalkingPhotoProvider';

export interface ASRConfig {
  apiKey?: string;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  [key: string]: any;
}

export interface ASRInput {
  audioPath: string;
  hintText?: string;
  config: ASRConfig;
}

export interface SubtitleItem {
  start: number;
  end: number;
  text: string;
}

export interface ASROutput {
  subtitles: SubtitleItem[];
  fullText: string;
}

export interface IASRProvider {
  readonly id: string;
  readonly displayName: string;
  readonly requiresApiKey: boolean;
  readonly supportsAlignment: boolean;

  validateConfig(config: ASRConfig): Promise<{ valid: boolean; errors: string[] }>;
  transcribe(input: ASRInput): Promise<ASROutput>;
  getConfigSchema(): ProviderConfigSchema;
}
