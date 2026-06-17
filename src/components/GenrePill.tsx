

interface GenrePillProps {
  genre: string;
}

export const GenrePill: React.FC<GenrePillProps> = ({ genre }) => {
  return (
    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-800 border border-gray-700 text-gray-300">
      {genre}
    </span>
  );
};
