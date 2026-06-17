

interface LoadingBarProps {
  progress: number; // 0-100
  text: string;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({ progress, text }) => {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
      <div className="text-sm font-medium animate-pulse">{text}</div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-purple-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
};
