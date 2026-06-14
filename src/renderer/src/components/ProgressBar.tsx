interface Props {
  value: number; // 0-100
  className?: string;
}

export default function ProgressBar({ value, className = '' }: Props) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={`w-full h-2 bg-muted rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
