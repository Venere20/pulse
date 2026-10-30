import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';

// Set di icone vettoriali (stile "outline", griglia 24x24) senza dipendenze esterne.
const ICONS = {
  search: <><Circle cx="10.5" cy="10.5" r="7.5" /><Line x1="16" y1="16" x2="22" y2="22" /></>,
  bell: <><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><Path d="M10 21h4" /></>,
  home: (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  heart: <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  image: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polyline points="21 15 16 10 5 21" />
    </>
  ),
  checkSquare: (
    <>
      <Polyline points="9 11 12 14 22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  sliders: (
    <>
      <Line x1="4" y1="21" x2="4" y2="14" />
      <Line x1="4" y1="10" x2="4" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12" y2="3" />
      <Line x1="20" y1="21" x2="20" y2="16" />
      <Line x1="20" y1="12" x2="20" y2="3" />
      <Line x1="1" y1="14" x2="7" y2="14" />
      <Line x1="9" y1="8" x2="15" y2="8" />
      <Line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  chevronLeft: <Polyline points="15 18 9 12 15 6" />,
  chevronRight: <Polyline points="9 18 15 12 9 6" />,
  chevronDown: <Polyline points="6 9 12 15 18 9" />,
  chevronUp: <Polyline points="18 15 12 9 6 15" />,
  plus: (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  x: (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  check: <Polyline points="20 6 9 17 4 12" />,
  mapPin: (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  map: (
    <>
      <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <Line x1="8" y1="2" x2="8" y2="18" />
      <Line x1="16" y1="6" x2="16" y2="22" />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  edit: <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  camera: (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </>
  ),
  download: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  send: (
    <>
      <Line x1="22" y1="2" x2="11" y2="13" />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </>
  ),
  dollar: (
    <>
      <Line x1="12" y1="1" x2="12" y2="23" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  zap: <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  helpCircle: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  sun: (
    <>
      <Circle cx="12" cy="12" r="5" />
      <Line x1="12" y1="1" x2="12" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="23" />
      <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <Line x1="1" y1="12" x2="3" y2="12" />
      <Line x1="21" y1="12" x2="23" y2="12" />
      <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
  ),
  navigation: <Polygon points="3 11 22 2 13 21 11 13 3 11" />,
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  users: (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  star: <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  message: <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  lock: (
    <>
      <Rect x="3" y="11" width="18" height="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  refresh: (
    <>
      <Polyline points="23 4 23 10 17 10" />
      <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  ),
  externalLink: (
    <>
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Polyline points="15 3 21 3 21 9" />
      <Line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  compass: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  plane: <Path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3.5l8 .5z" />,
  train: (
    <>
      <Rect x="5" y="3" width="14" height="14" rx="3" />
      <Line x1="5" y1="11" x2="19" y2="11" />
      <Line x1="8" y1="17" x2="6" y2="21" />
      <Line x1="16" y1="17" x2="18" y2="21" />
      <Line x1="9" y1="14" x2="9.01" y2="14" />
      <Line x1="15" y1="14" x2="15.01" y2="14" />
    </>
  ),
  ship: (
    <>
      <Path d="M3 17l1.5 3h15L21 17z" />
      <Line x1="12" y1="17" x2="12" y2="6" />
      <Polyline points="12 6 18 12 12 12" />
    </>
  ),
  car: (
    <>
      <Rect x="2" y="9" width="20" height="8" rx="2" />
      <Path d="M5 9l2-5h10l2 5" />
      <Circle cx="7" cy="17" r="2" />
      <Circle cx="17" cy="17" r="2" />
    </>
  ),
  bus: (
    <>
      <Rect x="4" y="3" width="16" height="14" rx="3" />
      <Line x1="4" y1="11" x2="20" y2="11" />
      <Line x1="6" y1="17" x2="6" y2="20" />
      <Line x1="18" y1="17" x2="18" y2="20" />
      <Line x1="8" y1="14" x2="8.01" y2="14" />
      <Line x1="16" y1="14" x2="16.01" y2="14" />
    </>
  ),
  flame: <Path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z" />,
  trophy: (
    <>
      <Path d="M8 21h8" />
      <Line x1="12" y1="17" x2="12" y2="21" />
      <Path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <Path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <Path d="M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  filled?: boolean;
}

export const Icon: React.FC<Props> = ({ name, size = 22, color, strokeWidth = 1.7, filled = false }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? color : 'none'}
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {ICONS[name]}
  </Svg>
);
