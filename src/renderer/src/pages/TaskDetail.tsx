import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Download, FolderOpen, RefreshCw } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import VideoPlayer from '../components/VideoPlayer';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadTask = async () => {
    if (!id) return;
    try {
      const data = await window.electronAPI.getTask(id);
      setTask(data);
    } catch (err: any) {
      toast.error(`加载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();

    const unsubscribe = window.electronAPI.onTaskProgress((data) => {
      if (data.taskId === id) {
        setTask((prev: any) => prev ? { ...prev, progress: data.progress, progressMessage: data.message, progressStep: data.step } : prev);
        if (data.step === 'done' || data.step === 'error') {
          loadTask();
        }
      }
    });

    return unsubscribe;
  }, [id]);

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (!task) return <div className="text-muted-foreground">任务未找到</div>;

  const statusLabel: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-500',
    running: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-gray-500'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/tasks')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        返回任务列表
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">任务详情</h2>
        <span className={`text-sm font-medium ${statusColor[task.status]}`}>
          {statusLabel[task.status] || task.status}
        </span>
      </div>

      {/* Progress */}
      {task.status === 'running' && (
        <div className="space-y-2">
          <ProgressBar value={task.progress || 0} />
          <p className="text-sm text-muted-foreground">{task.progressMessage || '处理中...'}</p>
        </div>
      )}

      {/* Error */}
      {task.status === 'failed' && task.errorMessage && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {task.errorMessage}
        </div>
      )}

      {/* Video Preview */}
      {task.outputVideoPath && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">生成的视频</h3>
          <VideoPlayer src={`file://${task.outputVideoPath}`} />
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card space-y-3 text-sm">
          <h3 className="font-semibold">任务信息</h3>
          <div className="space-y-2 text-muted-foreground">
            <p><span className="text-foreground font-medium">模式：</span>{task.mode === 'auto' ? '全自动' : '已有素材'}</p>
            <p><span className="text-foreground font-medium">数字人：</span>{task.talkingPhotoProviderId}</p>
            {task.ttsProviderId && <p><span className="text-foreground font-medium">TTS：</span>{task.ttsProviderId}</p>}
            {task.asrProviderId && <p><span className="text-foreground font-medium">ASR：</span>{task.asrProviderId}</p>}
            <p><span className="text-foreground font-medium">创建时间：</span>{new Date(task.createdAt).toLocaleString('zh-CN')}</p>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card space-y-3 text-sm">
          <h3 className="font-semibold">文件路径</h3>
          <div className="space-y-2 text-muted-foreground break-all">
            {task.avatarPath && <p><span className="text-foreground font-medium">头像：</span>{task.avatarPath}</p>}
            {task.audioPath && <p><span className="text-foreground font-medium">音频：</span>{task.audioPath}</p>}
            {task.outputVideoPath && <p><span className="text-foreground font-medium">视频：</span>{task.outputVideoPath}</p>}
            {task.subtitleSrtPath && <p><span className="text-foreground font-medium">字幕：</span>{task.subtitleSrtPath}</p>}
          </div>
        </div>
      </div>

      {/* Script Preview */}
      {task.scriptText && (
        <div className="p-4 rounded-lg border border-border bg-card text-sm">
          <h3 className="font-semibold mb-2">文案</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">{task.scriptText}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {task.outputVideoPath && (
          <button
            onClick={() => window.electronAPI.revealInFolder(task.outputVideoPath)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <FolderOpen className="w-4 h-4" />
            在文件夹中显示
          </button>
        )}
        {task.status === 'completed' && (
          <button
            onClick={() => {
              // Navigate to home with prefilled data
              navigate('/', { state: { prefill: task } });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80"
          >
            <RefreshCw className="w-4 h-4" />
            重新生成
          </button>
        )}
      </div>
    </div>
  );
}
