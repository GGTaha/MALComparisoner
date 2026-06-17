interface LoadingPageProps {
  progress: number;
  statusText: string;
}

export const LoadingPage: React.FC<LoadingPageProps> = ({ progress, statusText }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
      <div className="w-full max-w-xs">
        {/* Track */}
        <div className="h-0.5 w-full bg-zinc-800 rounded-full overflow-hidden">
          {/* Bar */}
          <div
            className="h-full bg-zinc-300 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* Status */}
        <p className="text-sm text-zinc-500 text-center mt-4">
          {statusText}
        </p>
      </div>
    </div>
  );
};
