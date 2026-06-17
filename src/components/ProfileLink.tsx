
import { ExternalLink } from 'lucide-react';

interface ProfileLinkProps {
  username: string;
  url: string;
  platform: 'mal' | 'letterboxd';
}

export const ProfileLink: React.FC<ProfileLinkProps> = ({ username, url, platform }) => {
  const platformColor = platform === 'mal' ? 'text-blue-400' : 'text-emerald-500';
  
  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
    >
      <span className={`font-bold text-xl ${platformColor}`}>{username}</span>
      <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors" />
    </a>
  );
};
