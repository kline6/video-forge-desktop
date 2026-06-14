import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import TaskCard from '../components/TaskCard';

export default function Tasks() {
  const { tasks, loading, fetchTasks, updateTaskProgress, cancelTask } = useStore();

  useEffect(() => {
    fetchTasks();

    const unsubscribe = window.electronAPI.onTaskProgress((data) => {
      updateTaskProgress(data.taskId, {
        step: data.step,
        progress: data.progress,
        message: data.message
      });
      // Refetch on completion or failure
      if (data.step === 'done' || data.step === 'error') {
        fetchTasks();
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">任务列表</h2>

      {loading && tasks.length === 0 && (
        <p className="text-muted-foreground">加载中...</p>
      )}

      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">暂无任务</p>
          <p className="text-sm mt-2">前往"创建任务"开始生成视频</p>
        </div>
      )}

      <div className="grid gap-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onCancel={cancelTask} />
        ))}
      </div>
    </div>
  );
}
