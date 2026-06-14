import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Video, ListTodo, Settings, Zap, Wand2 } from 'lucide-react';
import Home from './pages/Home';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import SettingsPage from './pages/Settings';
import Tools from './pages/Tools';

const navItems = [
  { path: '/', label: '创建任务', icon: Zap },
  { path: '/tasks', label: '任务列表', icon: ListTodo },
  { path: '/tools', label: '工具箱', icon: Wand2 },
  { path: '/settings', label: '设置', icon: Settings }
];

export default function App() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Video className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-semibold">VideoForge</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border text-xs text-muted-foreground">
          VideoForge Desktop v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/task/:id" element={<TaskDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tools" element={<Tools />} />
          </Routes>
        </div>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}
