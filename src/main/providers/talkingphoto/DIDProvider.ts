import { ITalkingPhotoProvider, TalkingPhotoConfig, TalkingPhotoInput, TalkingPhotoOutput, ProviderConfigSchema } from '../../interfaces/ITalkingPhotoProvider';
import axios from 'axios';
import { createWriteStream, readFileSync } from 'fs';
import { join } from 'path';
import { getTempDir, sleep } from '../../utils';
import { v4 as uuidv4 } from 'uuid';

export class DIDProvider implements ITalkingPhotoProvider {
  readonly id = 'did';
  readonly displayName = 'D-ID（需要 API Key）';
  readonly requiresApiKey = true;
  readonly supportsCustomParams = true;

  private keyIndex = 0;

  private getApiKey(config: TalkingPhotoConfig): string {
    const keys = Array.isArray(config.apiKeys) ? config.apiKeys : [config.apiKey];
    if (!keys || keys.length === 0) throw new Error('D-ID API Key not set');
    const key = keys[this.keyIndex % keys.length];
    this.keyIndex = (this.keyIndex + 1) % keys.length;
    return key;
  }

  private getBaseUrl(config: TalkingPhotoConfig): string {
    return config.apiEndpoint || 'https://api.d-id.com';
  }

  async validateConfig(config: TalkingPhotoConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const keys = Array.isArray(config.apiKeys) ? config.apiKeys : [config.apiKey];
    if (!keys || keys.length === 0 || !keys[0]) {
      errors.push('至少需要一个 D-ID API Key');
    }
    return { valid: errors.length === 0, errors };
  }

  async generate(input: TalkingPhotoInput): Promise<TalkingPhotoOutput> {
    const { imagePath, audioPath, config, onProgress } = input;
    const apiKey = this.getApiKey(config);
    const baseUrl = this.getBaseUrl(config);
    const driverId = config.defaultDriver || 'bank://natural/';

    onProgress?.(5, '上传图片...');

    // Step 1: Upload image
    const imageData = readFileSync(imagePath);
    const imageBase64 = `data:image/jpeg;base64,${imageData.toString('base64')}`;

    onProgress?.(15, '创建数字人任务...');

    // Step 2: Create talk
    const audioData = readFileSync(audioPath);
    const audioBase64 = `data:audio/mp3;base64,${audioData.toString('base64')}`;

    const createResponse = await axios.post(
      `${baseUrl}/talks`,
      {
        source_url: imageBase64,
        script: {
          type: 'audio',
          audio_url: audioBase64,
          provider: { type: 'microsoft' }
        },
        driver_id: driverId,
        config: { stitch: true }
      },
      {
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const talkId = createResponse.data.id;
    onProgress?.(25, '等待数字人渲染...');

    // Step 3: Poll for completion
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    while (attempts < maxAttempts) {
      await sleep(5000);
      attempts++;

      const statusResponse = await axios.get(`${baseUrl}/talks/${talkId}`, {
        headers: { Authorization: `Basic ${apiKey}` }
      });

      const status = statusResponse.data.status;
      const progressPct = 25 + Math.min(attempts * 0.6, 65);
      onProgress?.(progressPct, `渲染中... ${status}`);

      if (status === 'done') {
        onProgress?.(90, '下载视频...');
        const videoUrl = statusResponse.data.result_url;
        const outputPath = join(getTempDir(), `did-${uuidv4()}.mp4`);
        await this.downloadVideo(videoUrl, outputPath);
        onProgress?.(100, '完成');

        return {
          videoPath: outputPath,
          durationSeconds: statusResponse.data.duration || 0,
          metadata: { talkId }
        };
      }

      if (status === 'error' || status === 'rejected') {
        throw new Error(`D-ID 任务失败: ${statusResponse.data.error?.description || '未知错误'}`);
      }
    }

    throw new Error('D-ID task timeout (10 min)');
  }

  private async downloadVideo(url: string, outputPath: string): Promise<void> {
    const response = await axios.get(url, { responseType: 'stream', timeout: 120000 });
    return new Promise((resolve, reject) => {
      const writer = createWriteStream(outputPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  getConfigSchema(): ProviderConfigSchema {
    return {
      fields: [
        {
          name: 'apiKey',
          label: 'API Key（单个）',
          type: 'password',
          required: false,
          defaultValue: ''
        },
        {
          name: 'apiKeys',
          label: 'API Keys（多个，逗号分隔，用于轮询）',
          type: 'text',
          required: false,
          defaultValue: ''
        },
        {
          name: 'apiEndpoint',
          label: 'API 端点',
          type: 'text',
          defaultValue: 'https://api.d-id.com'
        },
        {
          name: 'defaultDriver',
          label: '驱动 ID',
          type: 'text',
          defaultValue: 'bank://natural/'
        }
      ]
    };
  }
}
