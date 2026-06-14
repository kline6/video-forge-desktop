import { IASRProvider, ASRConfig, ASRInput, ASROutput, SubtitleItem } from '../../interfaces/IASRProvider';
import { ProviderConfigSchema } from '../../interfaces/ITalkingPhotoProvider';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export class WhisperProvider implements IASRProvider {
  readonly id = 'whisper';
  readonly displayName = 'Whisper（本地离线）';
  readonly requiresApiKey = false;
  readonly supportsAlignment = true;

  private getWhisperPath(config: ASRConfig): string {
    return config.whisperPath || join(process.resourcesPath || '', 'bin', 'whisper');
  }

  private getModelPath(config: ASRConfig): string {
    return config.modelPath || '';
  }

  async validateConfig(config: ASRConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const whisperPath = this.getWhisperPath(config);
    if (!existsSync(whisperPath)) {
      errors.push(`Whisper 可执行文件未找到: ${whisperPath}`);
    }
    const modelPath = this.getModelPath(config);
    if (!modelPath || !existsSync(modelPath)) {
      errors.push(`模型文件路径无效: ${modelPath || '未设置'}`);
    }
    return { valid: errors.length === 0, errors };
  }

  async transcribe(input: ASRInput): Promise<ASROutput> {
    const { audioPath, hintText, config } = input;
    const whisperPath = this.getWhisperPath(config);
    const modelPath = this.getModelPath(config);
    const language = config.language || 'zh';
    const outputFormat = 'srt';

    return new Promise<ASROutput>((resolve, reject) => {
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '-l', language,
        '--output-format', outputFormat,
        '--output-dir', tmpdir()
      ];

      if (hintText && this.supportsAlignment) {
        args.push('--prompt', hintText);
      }

      execFile(whisperPath, args, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Whisper error: ${error.message}\n${stderr}`));
          return;
        }

        try {
          const subtitles = this.parseSrt(stdout);
          const fullText = subtitles.map((s) => s.text).join(' ');
          resolve({ subtitles, fullText });
        } catch (parseError) {
          reject(new Error(`Failed to parse Whisper output: ${parseError}`));
        }
      });
    });
  }

  private parseSrt(srtContent: string): SubtitleItem[] {
    const items: SubtitleItem[] = [];
    const blocks = srtContent.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const timeLine = lines[1];
      const match = timeLine.match(
        /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
      );
      if (!match) continue;

      const start =
        parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]) +
        parseInt(match[4]) / 1000;
      const end =
        parseInt(match[5]) * 3600 +
        parseInt(match[6]) * 60 +
        parseInt(match[7]) +
        parseInt(match[8]) / 1000;

      const text = lines.slice(2).join(' ').trim();
      items.push({ start, end, text });
    }

    return items;
  }

  getConfigSchema(): ProviderConfigSchema {
    return {
      fields: [
        {
          name: 'whisperPath',
          label: 'Whisper 可执行文件路径',
          type: 'text',
          required: true,
          defaultValue: ''
        },
        {
          name: 'modelPath',
          label: '模型文件路径（.bin）',
          type: 'text',
          required: true,
          defaultValue: ''
        },
        {
          name: 'language',
          label: '语言',
          type: 'select',
          required: true,
          defaultValue: 'zh',
          options: [
            { value: 'zh', label: '中文' },
            { value: 'en', label: '英文' },
            { value: 'ja', label: '日文' },
            { value: 'auto', label: '自动检测' }
          ]
        },
        {
          name: 'modelSize',
          label: '模型大小',
          type: 'select',
          defaultValue: 'base',
          options: [
            { value: 'tiny', label: 'Tiny（最快）' },
            { value: 'base', label: 'Base（平衡）' },
            { value: 'small', label: 'Small（较准）' },
            { value: 'medium', label: 'Medium（精确）' },
            { value: 'large', label: 'Large（最准，最慢）' }
          ]
        }
      ]
    };
  }
}
