import { app } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

export function getBaseDir(): string {
  const base = join(app.getPath('documents'), 'VideoForge');
  ensureDir(base);
  return base;
}

export function getOutputDir(taskId: string): string {
  const dir = join(getBaseDir(), 'output', taskId);
  ensureDir(dir);
  return dir;
}

export function getTempDir(): string {
  const dir = join(getBaseDir(), 'temp');
  ensureDir(dir);
  return dir;
}

export function getLogsDir(): string {
  const dir = join(getBaseDir(), 'logs');
  ensureDir(dir);
  return dir;
}

export function getLogPath(taskId: string): string {
  return join(getLogsDir(), `task-${taskId}.log`);
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
