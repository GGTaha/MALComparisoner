import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface PosterImageProps {
  url: string | null;
  alt: string;
  className?: string;
}

export const PosterImage: React.FC<PosterImageProps> = ({ url, alt, className = '' }) => {
  const [error, setError] = useState(false);

  if (!url || error) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 text-gray-500 rounded ${className}`}>
        <ImageOff size={24} />
      </div>
    );
  }

  return (
    <img 
      src={url} 
      alt={alt} 
      onError={() => setError(true)}
      className={`object-cover rounded ${className}`}
      loading="lazy"
    />
  );
};
