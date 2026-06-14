import type PQueueType from 'p-queue';
import { executeModeA } from './workers/modeA';
import { executeModeB } from './workers/modeB';

let queuePromise: Promise<PQueueType> | null = null;

async function getQueue(): Promise<PQueueType> {
  if (!queuePromise) {
    queuePromise = (async () => {
      const { default: PQueue } = await import('p-queue');
      return new PQueue({ concurrency: 2 });
    })();
  }

  return queuePromise;
}

export async function enqueueTask(
  taskId: string,
  mode: string,
  params: {
    scriptText: string;
    avatarPath?: string;
    audioPath?: string;
    talkingPhotoProviderId: string;
    ttsProviderId?: string;
    asrProviderId?: string;
    talkingPhotoConfig: Record<string, any>;
    ttsConfig: Record<string, any>;
    asrConfig: Record<string, any>;
    onProgress: (data: { step: string; progress: number; message: string }) => void;
  }
): Promise<void> {
  const queue = await getQueue();
  queue.add(async () => {
    try {
      if (mode === 'auto' || mode === 'A') {
        await executeModeA(taskId, params as any);
      } else {
        await executeModeB(taskId, params as any);
      }
    } catch (error: any) {
      console.error(`Task ${taskId} failed:`, error.message);
    }
  });
}

export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.size;
}

export async function getQueuePending(): Promise<number> {
  const queue = await getQueue();
  return queue.pending;
}
