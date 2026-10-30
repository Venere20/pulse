import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { T } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';

export interface PieDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: PieDatum[];
  size?: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
}

const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });

const slicePath = (cx: number, cy: number, r: number, start: number, end: number) => {
  const p1 = polar(cx, cy, r, start);
  const p2 = polar(cx, cy, r, end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
};

export const ExpensePieChart: React.FC<Props> = ({ data, size = 170, selected, onSelect }) => {
  const { c, r, s } = useTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return null;

  const cx = size / 2;
  const radius = size / 2 - 8;
  const slices = data.map((d,index) => {
    const frac = d.value / total;
    const start = -Math.PI/2 + data.slice(0,index).reduce((sum,item)=>sum+item.value/total*2*Math.PI,0);
    const end = start + frac * 2 * Math.PI;
    return { ...d, frac, start, end };
  });

  return (
    <View style={{ alignItems: 'center', gap: s.md }}>
      <Svg width={size} height={size} accessibilityLabel="Grafico a torta delle spese per categoria">
        {slices.length === 1 ? (
          <Circle cx={cx} cy={cx} r={radius} fill={slices[0].color} onPress={() => onSelect(selected === slices[0].key ? null : slices[0].key)} />
        ) : (
          slices.map((sl) => {
            const mid = (sl.start + sl.end) / 2;
            const isSel = selected === sl.key;
            const dx = isSel ? Math.cos(mid) * 7 : 0;
            const dy = isSel ? Math.sin(mid) * 7 : 0;
            return (
              <G key={sl.key} x={dx} y={dy} opacity={selected && !isSel ? 0.45 : 1}>
                <Path
                  d={slicePath(cx, cx, radius, sl.start, sl.end)}
                  fill={sl.color}
                  stroke={c.surface}
                  strokeWidth={2}
                  onPress={() => onSelect(isSel ? null : sl.key)}
                />
              </G>
            );
          })
        )}
        <Circle cx={cx} cy={cx} r={radius * 0.45} fill={c.surface} />
      </Svg>

      <View style={{ alignSelf: 'stretch', gap: 2 }}>
        {slices.map((sl) => (
          <TouchableOpacity
            key={sl.key}
            accessibilityRole="button"
            accessibilityLabel={`${sl.label}: ${sl.value.toFixed(2)} euro`}
            onPress={() => onSelect(selected === sl.key ? null : sl.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s.sm,
              minHeight: 40,
              paddingHorizontal: s.sm,
              borderRadius: r.md,
              backgroundColor: selected === sl.key ? c.surfaceAlt : 'transparent',
            }}
          >
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: sl.color }} />
            <T style={{ flex: 1 }}>{sl.label}</T>
            <T bold>€ {sl.value.toFixed(2)}</T>
            <T tone="muted" style={{ width: 48, textAlign: 'right' }}>{(sl.frac * 100).toFixed(0)}%</T>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
