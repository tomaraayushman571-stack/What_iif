import { useState } from 'react';
import { Film } from 'lucide-react';

interface EditorialImageProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}

export function EditorialImage({ src, alt, caption, className = '' }: EditorialImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE6] border border-[#E5E0D5] text-[#57534E] p-8 text-center ${className}`}
      >
        <Film className="w-7 h-7 mb-3 text-[#9A3412]" aria-hidden="true" />
        <p className="font-editorial text-sm font-medium text-[#161514]">{alt}</p>
        {caption && <p className="text-xs text-[#78716C] mt-1">{caption}</p>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
