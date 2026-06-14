import { ProviderManager } from '../ProviderManager';
import { updateTask } from '../database';
import { getOutputDir } from '../utils';
import { burnSubtitles, generateSrt, getVideoDuration } from './ffmpeg';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { SubtitleItem } from '../interfaces/IASRProvider';

interface ModeBParams {
  scriptText: string;
  avatarPath: string;
  audioPath: string;
  talkingPhotoProviderId: string;
  asrProviderId?: string;
  talkingPhotoConfig: Record<string, any>;
  asrConfig: Record<string, any>;
  onProgress: (data: { step: string; progress: number; message: string }) => void;
}

export async function executeModeB(taskId: string, params: ModeBParams): Promise<void> {
  const pm = ProviderManager.getInstance();
  const outputDir = getOutputDir(taskId);

  try {
    await updateTask(taskId, { status: 'running' });

    // Step 1: ASR (optional, for subtitle alignment)
    let subtitles: SubtitleItem[] = [];
    if (params.asrProviderId && params.asrProviderId !== 'simple') {
      params.onProgress({ step: 'asr', progress: 5, message: '正在识别语音...' });
      const asrOutput = await pm.callASR(params.asrProviderId, {
        audioPath: params.audioPath,
        hintText: params.scriptText,
        config: params.asrConfig
      });
      subtitles = asrOutput.subtitles;
      params.onProgress({ step: 'asr', progress: 20, message: '语音识别完成' });
    } else {
      const duration = await getVideoDuration(params.audioPath).catch(() => 30);
      subtitles = generateSimpleSubtitles(params.scriptText, duration);
      params.onProgress({ step: 'asr', progress: 20, message: '字幕时间轴已生成（均分模式）' });
    }

    // Generate SRT
    const srtContent = generateSrt(subtitles);
    const srtPath = join(outputDir, 'subtitle.srt');
    writeFileSync(srtPath, srtContent, 'utf-8');
    await updateTask(taskId, { subtitleSrtPath: srtPath });

    // Step 2: TalkingPhoto
    params.onProgress({ step: 'talkingPhoto', progress: 25, message: '正在生成数字人视频...' });
    const talkingPhotoOutput = await pm.callTalkingPhoto(params.talkingPhotoProviderId, {
      imagePath: params.avatarPath,
      audioPath: params.audioPath,
      config: params.talkingPhotoConfig,
      onProgress: (pct, msg) => {
        params.onProgress({ step: 'talkingPhoto', progress: 25 + pct * 0.55, message: msg || `数字人渲染中 ${Math.round(pct)}%` });
      }
    });

    await updateTask(taskId, { didVideoPath: talkingPhotoOutput.videoPath });
    params.onProgress({ step: 'ffmpeg', progress: 82, message: '开始烧录字幕...' });

    // Step 3: Burn subtitles
    const finalPath = join(outputDir, 'final.mp4');
    await burnSubtitles(
      talkingPhotoOutput.videoPath,
      srtContent,
      finalPath,
      (pct, msg) => {
        params.onProgress({ step: 'ffmpeg', progress: 82 + pct * 0.18, message: msg });
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
