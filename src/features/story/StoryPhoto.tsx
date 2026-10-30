import React from 'react';
import { StoredPhoto } from '../../components/StoredPhoto';
import { PhotoLayout } from '../memories/photoLayout';
import { STORY_PHOTO_BUCKET } from './photos';

export function StoryPhoto({ path, layout }: { path: string; layout?: PhotoLayout }) {
  return <StoredPhoto bucket={STORY_PHOTO_BUCKET} path={path} layout={layout} label="Foto del vostro momento" />;
}
