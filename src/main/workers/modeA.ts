import { ProviderManager } from '../ProviderManager';
import { updateTask } from '../database';
import { getOutputDir, getTempDir } from '../utils';
import { burnSubtitles, generateSrt } from './ffmpeg';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SubtitleItem } from '../interfaces/IASRProvider';
import { writeFileSync } from 'fs';

interface ModeAParams {
  scriptText: string;
  avatarPath?: string;
  talkingPhotoProviderId: string;
  ttsProviderId: string;
  asrProviderId?: string;
  talkingPhotoConfig: Record<string, any>;
  ttsConfig: Record<string, any>;
  asrConfig: Record<string, any>;
  onProgress: (data: { step: string; progress: number; message: string }) => void;
}

export async function executeModeA(taskId: string, params: ModeAParams): Promise<void> {
  const pm = ProviderManager.getInstance();
  const outputDir = getOutputDir(taskId);

  try {
    await updateTask(taskId, { status: 'running' });

    // Step 1: TTS
    params.onProgress({ step: 'tts', progress: 5, message: '正在生成语音...' });
    const ttsOutput = await pm.callTTS(params.ttsProviderId, {
      text: params.scriptText,
      config: params.ttsConfig,
      onProgress: (pct) => {
        params.onProgress({ step: 'tts', progress: 5 + pct * 0.25, message: `语音生成中 ${Math.round(pct)}%` });
      }
    });

    await updateTask(taskId, { audioPath: ttsOutput.audioPath });
    params.onProgress({ step: 'asr', progress: 30, message: '语音生成完成，准备字幕...' });

    // Step 2: ASR (optional)
    let subtitles: SubtitleItem[] = [];
    if (params.asrProviderId && params.asrProviderId !== 'simple') {
      params.onProgress({ step: 'asr', progress: 32, message: '正在识别语音...' });
      const asrOutput = await pm.callASR(params.asrProviderId, {
        audioPath: ttsOutput.audioPath,
        hintText: params.scriptText,
        config: params.asrConfig
      });
      subtitles = asrOutput.subtitles;
      params.onProgress({ step: 'asr', progress: 45, message: '语音识别完成' });
    } else {
      // Simple subtitle split
      subtitles = generateSimpleSubtitles(params.scriptText, ttsOutput.durationSeconds);
      params.onProgress({ step: 'asr', progress: 45, message: '字幕时间轴已生成（均分模式）' });
    }

    // Generate SRT file
    const srtContent = generateSrt(subtitles);
    const srtPath = join(outputDir, 'subtitle.srt');
    writeFileSync(srtPath, srtContent, 'utf-8');
    await updateTask(taskId, { subtitleSrtPath: srtPath });

    // Step 3: TalkingPhoto (Digital Avatar)
    params.onProgress({ step: 'talkingPhoto', progress: 48, message: '正在生成数字人视频...' });
    const talkingPhotoOutput = await pm.callTalkingPhoto(params.talkingPhotoProviderId, {
      imagePath: params.avatarPath || '',
      audioPath: ttsOutput.audioPath,
      config: params.talkingPhotoConfig,
      onProgress: (pct, msg) => {
        params.onProgress({ step: 'talkingPhoto', progress: 48 + pct * 0.35, message: msg || `数字人渲染中 ${Math.round(pct)}%` });
      }
    });

    await updateTask(taskId, { didVideoPath: talkingPhotoOutput.videoPath });
    params.onProgress({ step: 'ffmpeg', progress: 85, message: '数字人视频生成完成，开始烧录字幕...' });

    // Step 4: Burn subtitles
    const finalPath = join(outputDir, 'final.mp4');
    await burnSubtitles(
      talkingPhotoOutput.videoPath,
      srtContent,
      finalPath,
      (pct, msg) => {
        params.onProgress({ step: 'ffmpeg', progress: 85 + pct * 0.15, message: msg });
      }
    );

    await updateTask(taskId, {
      status: 'completed',
      outputVideoPath: finalPath
    });

    params.onProgress({ step: 'done', progress: 100, message: '任务完成！' });
  } catch (error: any) {
    await updateTask(taskId, {
      status: 'failed',
      errorMessage: error.message
    });
    params.onProgress({ step: 'error', progress: 0, message: `失败: ${error.message}` });
    throw error;
  }
}

function generateSimpleSubtitles(text: string, totalDuration: number): SubtitleItem[] {
  // Split by punctuation or line breaks
  const segments = text.split(/[。！？\n.!?]+/).filter((s) => s.trim().length > 0);
  if (segments.length === 0) {
    return [{ start: 0, end: totalDuration, text }];
  }

  const charCount = segments.reduce((sum, s) => sum + s.length, 0);
  let currentTime = 0;

  return segments.map((segment) => {
    const proportion = segment.length / charCount;
    const duration = proportion * totalDuration;
    const start = currentTime;
    const end = currentTime + duration;
    currentTime = end;
    return { start, end, text: segment.trim() };
  });
}
