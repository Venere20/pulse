import React from 'react';
import { MemoryPhoto } from './MemoryPhoto';

type Props = Omit<React.ComponentProps<typeof MemoryPhoto>, 'preferPreview'>;
export function MemoryPhotoPreview(props: Props) {
  return <MemoryPhoto {...props} preferPreview />;
}
