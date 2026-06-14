import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Loader2, Ban } from 'lucide-react';
import ProgressBar from './ProgressBar';

interface Task {
  id: string;
  mode: string;
  status: string;
  scriptText: string;
  talkingPhotoProviderId: string;
  ttsProviderId: string | null;
  createdAt: number;
  updatedAt: number;
  errorMessage: string | null;
  progress?: number;
  progressMessage?: string;
}

interface Props {
  task: Task;
  onCancel: (id: string) => void;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: '等待中', icon: Clock, color: 'text-yellow-500' },
  running: { label: '运行中', icon: Loader2, color: 'text-blue-500 animate-spin' },
  completed: { label: '已完成', icon: CheckCircle, color: 'text-green-500' },
  failed: { label: '失败', icon: XCircle, color: 'text-red-500' },
  cancelled: { label: '已取消', icon: Ban, color: 'text-gray-500' }
};

export default function TaskCard({ task, onCancel }: Props) {
  const navigate = useNavigate();
  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const preview = task.scriptText?.slice(0, 60) || '（无文案）';

  return (
    <div
      className="p-4 rounded-lg border border-border bg-card hover:border-ring/50 cursor-pointer transition-colors"
      onClick={() => navigate(`/task/${task.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={`w-4 h-4 ${status.color}`} />
            <span className="text-sm font-medium">{status.label}</span>
            <span className="text-xs text-muted-foreground">
              {task.mode === 'auto' ? '全自动' : '已有素材'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{preview}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(task.createdAt).toLocaleString('zh-CN')}
            {' · '}
            {task.talkingPhotoProviderId}
            {task.ttsProviderId ? ` · ${task.ttsProviderId}` : ''}
          </p>
        </div>

        {task.status === 'pending' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(task.id);
            }}
            className="text-xs text-muted-foreground hover:text-destructive shrink-0"
          >
            取消
          </button>
        )}
      </div>

      {task.status === 'running' && (
        <div className="mt-3">
          <ProgressBar value={task.progress || 0} />
          {task.progressMessage && (
            <p className="text-xs text-muted-foreground mt-1">{task.progressMessage}</p>
          )}
        </div>
      )}

      {task.status === 'failed' && task.errorMessage && (
        <p className="text-xs text-destructive mt-2 truncate">{task.errorMessage}</p>
      )}
    </div>
  );
}
