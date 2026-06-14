interface Props {
  src: string;
  className?: string;
}

export default function VideoPlayer({ src, className = '' }: Props) {
  return (
    <div className={`rounded-lg overflow-hidden border border-border ${className}`}>
      <video
        src={src}
        controls
        className="w-full max-h-[480px] bg-black"
        preload="metadata"
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
}
