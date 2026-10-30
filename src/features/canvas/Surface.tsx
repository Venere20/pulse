import React, { useRef } from 'react';
import { View } from 'react-native';
import { Stroke } from './protocol';
import { Drawing } from './Drawing';
export { Drawing } from './Drawing';
export interface SurfaceProps { strokes: Stroke[]; onBegin: (x: number, y: number) => void; onPoint: (x: number, y: number) => void; onEnd: () => void; enabled?: boolean }
export function Surface({ strokes, onBegin, onPoint, onEnd, enabled = true }: SurfaceProps) {
  const layout = useRef({ width: 1, height: 1 }); const origin = useRef({ x: 0, y: 0 }); const drawing = useRef(false);
  const point = (x: number, y: number) => [x / layout.current.width * 1000, y / layout.current.height * 1000] as const;
  const end = () => { if (drawing.current) { drawing.current = false; onEnd(); } };
  return <View accessible accessibilityLabel={enabled ? 'Lavagna. Trascina un dito o una penna per disegnare' : 'Lavagna in modalità scorrimento'} onLayout={e => { layout.current = e.nativeEvent.layout; }} onStartShouldSetResponder={() => enabled} onMoveShouldSetResponder={() => enabled} onResponderTerminationRequest={() => !enabled}
    onResponderGrant={e => { if (!enabled) return; const n = e.nativeEvent; origin.current = { x: n.pageX - n.locationX, y: n.pageY - n.locationY }; drawing.current = true; onBegin(...point(n.locationX, n.locationY)); }}
    onResponderMove={e => { if (enabled && drawing.current && e.nativeEvent.touches.length === 1) onPoint(...point(e.nativeEvent.pageX - origin.current.x, e.nativeEvent.pageY - origin.current.y)); }} onResponderRelease={end} onResponderTerminate={end} style={{ width: '100%', aspectRatio: 1, backgroundColor: '#17131F', borderRadius: 20, overflow: 'hidden' }}><View pointerEvents="none" style={{ flex: 1 }}><Drawing strokes={strokes} /></View></View>;
}
