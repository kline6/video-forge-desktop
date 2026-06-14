import ffmpeg from 'fluent-ffmpeg';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SubtitleItem } from '../interfaces/IASRProvider';
import { getTempDir } from '../utils';
import { v4 as uuidv4 } from 'uuid';

function getFfmpegPath(): string {
  // Try bundled first, then system
  const bundled = join(process.resourcesPath || '', 'bin', 'ffmpeg');
  if (existsSync(bundled)) return bundled;
  return 'ffmpeg'; // fallback to system PATH
}

export function generateSrt(subtitles: SubtitleItem[]): string {
  let srt = '';
  subtitles.forEach((item, index) => {
    const start = formatSrtTime(item.start);
    const end = formatSrtTime(item.end);
    srt += `${index + 1}\n${start} --> ${end}\n${item.text}\n\n`;
  });
  return srt;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function burnSubtitles(
  videoPath: string,
  srtContent: string,
  outputPath: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  const srtPath = join(getTempDir(), `sub-${uuidv4()}.srt`);
  writeFileSync(srtPath, srtContent, 'utf-8');

  return new Promise<string>((resolve, reject) => {
    onProgress?.(10, '烧录字幕中...');

    ffmpeg(videoPath)
      .setFfmpegPath(getFfmpegPath())
      .videoFilter(`subtitles=${srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')}`)
      .outputOptions(['-c:a copy'])
      .on('progress', (progress) => {
        const pct = progress.percent || 0;
        onProgress?.(10 + pct * 0.8, `烧录字幕中... ${Math.round(pct)}%`);
      })
      .on('end', () => {
        onProgress?.(100, '字幕烧录完成');
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg 字幕烧录失败: ${err.message}`));
      })
      .save(outputPath);
  });
}

export function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

export function mergeAudioVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    onProgress?.(10, '合并音视频...');

    ffmpeg()
      .setFfmpegPath(getFfmpegPath())
      .input(videoPath)
      .input(audioPath)
      .outputOptions(['-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0', '-shortest'])
      .on('progress', (progress) => {
        const pct = progress.percent || 0;
        onProgress?.(10 + pct * 0.8, `合并中... ${Math.round(pct)}%`);
      })
      .on('end', () => {
        onProgress?.(100, '合并完成');
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg 合并失败: ${err.message}`));
      })
      .save(outputPath);
  });
}
