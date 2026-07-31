import Image from 'next/image';
import { memo } from 'react';

const OptimizedImage = memo(({ src, alt, width, height, priority = false, ...props }) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      quality={75} // Optimize quality for better performance
      {...props}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
