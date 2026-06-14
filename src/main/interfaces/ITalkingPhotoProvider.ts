export interface TalkingPhotoConfig {
  apiKey?: string;
  apiEndpoint?: string;
  [key: string]: any;
}

export interface TalkingPhotoInput {
  imagePath: string;
  audioPath: string;
  config: TalkingPhotoConfig;
  onProgress?: (progress: number, message: string) => void;
}

export interface TalkingPhotoOutput {
  videoPath: string;
  durationSeconds: number;
  metadata?: any;
}

export interface ITalkingPhotoProvider {
  readonly id: string;
  readonly displayName: string;
  readonly requiresApiKey: boolean;
  readonly supportsCustomParams: boolean;

  validateConfig(config: TalkingPhotoConfig): Promise<{ valid: boolean; errors: string[] }>;
  generate(input: TalkingPhotoInput): Promise<TalkingPhotoOutput>;
  getConfigSchema(): ProviderConfigSchema;
}

export interface ProviderConfigSchema {
  fields: {
    name: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'number';
    required?: boolean;
    defaultValue?: any;
    options?: { value: string; label: string }[];
  }[];
}
