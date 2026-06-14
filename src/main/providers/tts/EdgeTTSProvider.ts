import { ITTSProvider, TTSConfig, TTSInput, TTSOutput } from '../../interfaces/ITTSProvider';
import { ProviderConfigSchema } from '../../interfaces/ITalkingPhotoProvider';
let cachedEdgeTts: any = null;

async function loadEdgeTts() {
  if (!cachedEdgeTts) {
    cachedEdgeTts = await import('edge-tts/out/index.js');
  }
  return cachedEdgeTts;
}

import { createWriteStream } from 'fs';
import { join } from 'path';
import { getTempDir } from '../../utils';
import { v4 as uuidv4 } from 'uuid';

export class EdgeTTSProvider implements ITTSProvider {
  readonly id = 'edgetts';
  readonly displayName = 'Edge TTS（免费）';
  readonly requiresApiKey = false;
  readonly supportsSsml = false;

  async validateConfig(_config: TTSConfig): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }

  async synthesize(input: TTSInput): Promise<TTSOutput> {
    const { text, config, onProgress } = input;
    const voiceName = config.voiceName || 'zh-CN-XiaoxiaoNeural';
    const speed = config.speed || 1.0;

    const tts = new (await loadEdgeTts()).MsEdgeTTS();
    await tts.setMetadata(voiceName, (await loadEdgeTts()).OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const audioFileName = `tts-${uuidv4()}.mp3`;
    const audioPath = join(getTempDir(), audioFileName);

    const ssml = this.buildSsml(text, voiceName, speed);
    const readable = tts.toStream(ssml);

    return new Promise<TTSOutput>((resolve, reject) => {
      const writeStream = createWriteStream(audioPath);
      let received = false;

      readable.on('data', (chunk: Buffer) => {
        writeStream.write(chunk);
        if (!received) {
          received = true;
          onProgress?.(50);
        }
      });

      readable.on('end', () => {
        writeStream.end();
        onProgress?.(100);
        // Estimate duration: ~150 chars/min for Chinese
        const durationSeconds = Math.max(text.length / 5, 1);
        resolve({
          audioPath,
          durationSeconds,
          characterCount: text.length
        });
      });

      readable.on('error', (err: Error) => {
        writeStream.destroy();
        reject(new Error(`EdgeTTS error: ${err.message}`));
      });
    });
  }

  private buildSsml(text: string, voice: string, speed: number): string {
    const rate = speed >= 1 ? `+${Math.round((speed - 1) * 100)}%` : `-${Math.round((1 - speed) * 100)}%`;
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
  <voice name="${voice}">
    <prosody rate="${rate}">${text}</prosody>
  </voice>
</speak>`;
  }

  getConfigSchema(): ProviderConfigSchema {
    return {
      fields: [
        {
          name: 'voiceName',
          label: '语音',
          type: 'select',
          required: true,
          defaultValue: 'zh-CN-XiaoxiaoNeural',
          options: [
            { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女，温和）' },
            { value: 'zh-CN-YunxiNeural', label: '云希（男，阳光）' },
            { value: 'zh-CN-YunjianNeural', label: '云健（男，沉稳）' },
            { value: 'zh-CN-XiaoyiNeural', label: '晓艺（女，活泼）' },
            { value: 'en-US-JennyNeural', label: 'Jenny（女，英文）' },
            { value: 'en-US-GuyNeural', label: 'Guy（男，英文）' },
            { value: 'ja-JP-NanamiNeural', label: 'Nanami（女，日文）' }
          ]
        },
        {
          name: 'speed',
          label: '语速',
          type: 'number',
          defaultValue: 1.0
        }
      ]
    };
  }
}
