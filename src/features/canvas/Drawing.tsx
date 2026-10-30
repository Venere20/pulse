import React, { memo, useId } from 'react';
import Svg, { Path, Defs, Mask, Rect, G } from 'react-native-svg';
import { Stroke, pathForStroke } from './protocol';
import { eraserPath } from './eraser';
const StrokePath = memo(function StrokePath({ stroke: s }: { stroke: Stroke }) {
  const path = pathForStroke(s);
  const id = 'erase' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return <>{!!s.erasures?.length && <Defs><Mask id={id} x="0" y="0" width="1000" height="1000" maskUnits="userSpaceOnUse"><Rect x="0" y="0" width="1000" height="1000" fill="white" />{Array.from({ length: s.erasures.length / 5 }, (_, i) => <Path key={i} d={eraserPath(s.erasures!.slice(i * 5, i * 5 + 5))} fill="black" />)}</Mask></Defs>}<G mask={s.erasures?.length ? `url(#${id})` : undefined}>{s.brush === 'neon' && <Path d={path} stroke={s.color} strokeWidth={s.width * 3} opacity={0.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}<Path d={path} stroke={s.brush === 'neon' ? '#FFFFFF' : s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" /></G></>;
});
export const Drawing = memo(function Drawing({ strokes }: { strokes: Stroke[] }) { return <Svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none">{strokes.map(s => <StrokePath key={s.id} stroke={s} />)}</Svg>; });
