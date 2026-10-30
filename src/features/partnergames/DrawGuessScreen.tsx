import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Surface, Drawing } from '../canvas/Surface';
import {
  Stroke,
  canvasColors,
  canvasPalette,
} from '../canvas/protocol';
import {
  CanvasTool,
  ShapeTool,
  canvasPoint,
  shapePoints,
  hasShapeSize,
} from '../canvas/tools';
import {
  erasePortion,
  ERASER_RADIUS,
} from '../canvas/eraser';
import { drawingPatch } from './drawingPatch';

import {
  Button,
  Card,
  Chip,
  Input,
  T,
} from '../../ui/primitives';
import {
  Screen,
  Header,
  BottomSheet,
  IconButton,
} from '../../ui/layout';
import { FeatureFrame } from '../FeatureFrame';
import { useTheme } from '../../theme/ThemeProvider';
import { useInsets } from '../../ui/safeArea';
import { MIN_TOUCH } from '../../theme/tokens';

import { MatchStatus } from './MatchStatus';
import { usePartnerGame } from './usePartnerGame';

type Game = ReturnType<typeof usePartnerGame>;
type ToolPanel = 'colors' | 'width' | null;
type Confirmation = 'reveal' | 'cancel' | 'clear' | null;

const SHAPES: { id: ShapeTool; label: string }[] = [
  { id: 'line', label: 'Linea' },
  { id: 'rectangle', label: 'Rettangolo' },
  { id: 'circle', label: 'Cerchio' },
];

const WIDTHS = [
  { value: 3, label: 'Fine' },
  { value: 6, label: 'Medio' },
  { value: 12, label: 'Grande' },
] as const;

function ToolButton({
  label,
  symbol,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  symbol: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c, r, s } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        selected,
        disabled: !!disabled,
      }}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 58,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingHorizontal: s.xs,
        backgroundColor: selected ? c.primarySoft : c.surface,
        borderColor: selected ? c.primary : c.border,
        borderWidth: 1,
        borderRadius: r.md,
      }}
    >
      <T
        style={{
          fontSize: 19,
          color: selected ? c.primary : c.textMuted,
        }}
      >
        {symbol}
      </T>

      <T
        v="caption"
        bold={selected}
        numberOfLines={1}
        style={{ fontSize: 12 }}
      >
        {label}
      </T>
    </TouchableOpacity>
  );
}

function ColorSwatch({
  color,
  label,
  selected,
  onPress,
}: {
  color: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Seleziona ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: MIN_TOUCH / 2,
        borderWidth: selected ? 2 : 0,
        borderColor: c.primary,
      }}
    >
      <View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: c.border,
        }}
      />
    </TouchableOpacity>
  );
}

function DrawingRound({
  g,
  onDrawing,
}: {
  g: Game;
  onDrawing: (value: boolean) => void;
}) {
  const m = g.match!;
  const drawer = m.state.drawer === g.d.userId;
  const playing = m.status === 'playing';

  const { c, r, s } = useTheme();
  const insets = useInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [guess, setGuess] = useState('');
  const [tool, setTool] = useState<CanvasTool>('draw');
  const [width, setWidth] = useState<3 | 6 | 12>(6);
  const [toolPanel, setToolPanel] = useState<ToolPanel>(null);
  const [color, setColor] = useState<string>(canvasColors[0]);

  const [strokes, setStrokes] = useState<Stroke[]>(
    m.state.strokes ?? [],
  );
  const [drawing, setDrawing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [confirmation, setConfirmation] =
    useState<Confirmation>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const lastShape = useRef<ShapeTool>('line');
  const submittingGuess = useRef(false);

  const board = useRef<Stroke[]>(m.state.strokes ?? []);
  const active = useRef<Stroke | null>(null);

  const shape = useRef<{
    tool: ShapeTool;
    start: readonly number[];
    stroke: Stroke;
  } | null>(null);

  const erasing = useRef(false);
  const lastErasePoint = useRef<readonly number[] | null>(null);
  const pending = useRef(false);
  const frame = useRef<number | null>(null);

  const attempts = m.state.guesses ?? [];
  const remaining = Math.max(0, 8 - attempts.length);
  const shapeSelected =
    tool === 'line' ||
    tool === 'rectangle' ||
    tool === 'circle';

  const selectedColor = canvasPalette.find(
    (item) => item.color === color,
  );

  const firstColors = canvasPalette.slice(
    0,
    windowWidth < 360 ? 4 : 5,
  );

  const quickColors = firstColors.some(
    (item) => item.color === color,
  )
    ? firstColors
    : [
        ...firstColors.slice(0, -1),
        selectedColor ?? {
          color,
          label: 'Colore selezionato',
        },
      ];

  // ---------------------------------------------
  // LOGICA DI DISEGNO ESISTENTE
  // ---------------------------------------------

  useEffect(() => {
    if (
      !pending.current &&
      !active.current &&
      !shape.current &&
      !erasing.current
    ) {
      board.current = m.state.strokes ?? [];
      setStrokes(board.current);
    }
  }, [m.revision, m.state.strokes]);

  useEffect(() => {
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => onDrawing(false);
  }, [onDrawing]);

  const repaint = () => {
    if (frame.current !== null) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = null;

      const snapshot = board.current.map((stroke) => ({
        ...stroke,
        points: [...stroke.points],
      }));

      setStrokes(
        shape.current
          ? [...snapshot, shape.current.stroke]
          : snapshot,
      );
    });
  };

  const point = (x: number, y: number) => {
    if (erasing.current) {
      eraseAt(x, y);
      return;
    }

    if (shape.current) {
      shape.current.stroke = {
        ...shape.current.stroke,
        points: shapePoints(
          shape.current.tool,
          shape.current.start,
          [x, y],
        ),
      };
      repaint();
      return;
    }

    const stroke = active.current;
    if (!stroke) return;

    if (
      board.current.reduce(
        (sum, item) => sum + item.points.length / 2,
        0,
      ) >= 3000
    ) {
      return;
    }

    const px = Math.round(
      Math.max(0, Math.min(1000, x)),
    );
    const py = Math.round(
      Math.max(0, Math.min(1000, y)),
    );

    if (
      stroke.points.length &&
      Math.abs(
        px - stroke.points[stroke.points.length - 2],
      ) +
        Math.abs(
          py - stroke.points[stroke.points.length - 1],
        ) <
        2
    ) {
      return;
    }

    stroke.points.push(px, py);
    pending.current = true;
    repaint();
  };

  // Mantiene drawingPatch e draw_patch.
  const publish = async () => {
    if (
      active.current ||
      shape.current ||
      erasing.current ||
      g.busy
    ) {
      return;
    }

    const snapshot = board.current.map((stroke) => ({
      ...stroke,
      points: [...stroke.points],
    }));

    const patch = drawingPatch(
      m.state.strokes ?? [],
      snapshot,
      m.state.drawing_revision ?? 0,
    );

    if (!patch || (await g.act('draw_patch', patch))) {
      pending.current = false;
      setDirty(false);
    }
  };

  const eraseAt = (x: number, y: number) => {
    const last = lastErasePoint.current;
    const end = [canvasPoint(x), canvasPoint(y)];

    if (
      last &&
      Math.hypot(
        end[0] - last[0],
        end[1] - last[1],
      ) < 4
    ) {
      return;
    }

    lastErasePoint.current = end;
    let changed = false;

    board.current = board.current.map((stroke) => {
      const next = erasePortion(
        stroke,
        g.d.userId,
        [...(last ?? end), ...end, ERASER_RADIUS],
      );

      if (next !== stroke) changed = true;
      return next;
    });

    if (changed) {
      pending.current = true;
      setDirty(true);
      repaint();
    }
  };

  const begin = (x: number, y: number) => {
    if (
      g.busy ||
      !drawer ||
      !playing ||
      toolPanel ||
      showMore
    ) {
      return;
    }

    if (tool === 'eraser') {
      erasing.current = true;
      lastErasePoint.current = null;
      setDrawing(true);
      onDrawing(true);
      eraseAt(x, y);
      return;
    }

    const pointCount = board.current.reduce(
      (sum, stroke) => sum + stroke.points.length / 2,
      0,
    );

    if (
      board.current.length >= 60 ||
      pointCount >= 3000
    ) {
      return;
    }

    const stroke: Stroke = {
      id:
        g.d.userId +
        ':' +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      author: g.d.userId,
      color,
      width,
      brush: 'ink',
      points: [],
    };

    setDrawing(true);
    onDrawing(true);

    if (tool !== 'draw') {
      const start = [canvasPoint(x), canvasPoint(y)];

      shape.current = {
        tool,
        start,
        stroke: {
          ...stroke,
          points: shapePoints(tool, start, start),
        },
      };
      repaint();
      return;
    }

    active.current = stroke;
    board.current = [...board.current, stroke];
    setDirty(true);
    point(x, y);
  };

  const end = () => {
    const gesture = shape.current;
    shape.current = null;

    if (gesture && hasShapeSize(gesture.stroke.points)) {
      const count = board.current.reduce(
        (sum, stroke) => sum + stroke.points.length / 2,
        0,
      );

      if (
        board.current.length < 60 &&
        count + gesture.stroke.points.length / 2 <= 3000
      ) {
        board.current = [
          ...board.current,
          gesture.stroke,
        ];
        pending.current = true;
        setDirty(true);
      }
    }

    active.current = null;
    erasing.current = false;
    lastErasePoint.current = null;

    setDrawing(false);
    onDrawing(false);
    repaint();

    if (pending.current) {
      void publish();
    }
  };

  const undo = () => {
    if (
      g.busy ||
      drawing ||
      !board.current.length
    ) {
      return;
    }

    board.current = board.current.slice(0, -1);
    pending.current = true;
    setDirty(true);
    repaint();
    void publish();
  };

  const requestEnd = async (
    action: 'reveal' | 'cancel',
  ) => {
    if (g.busy || drawing) return;

    if (playing) setConfirmation(action);
  };

  const confirmEnd = async () => {
    if (
      !confirmation ||
      g.busy ||
      drawing
    ) {
      return;
    }

    if (confirmation === 'clear') {
      board.current = [];
      pending.current = true;
      setDirty(true);
      repaint();

      setConfirmation(null);
      setShowMore(false);
      await publish();
      return;
    }

    if (await g.act(confirmation)) {
      setConfirmation(null);
      setShowMore(false);
    }
  };

  const submitGuess = async () => {
    const value = guess.trim();

    if (
      !value ||
      g.busy ||
      remaining === 0 ||
      submittingGuess.current
    ) {
      return;
    }

    submittingGuess.current = true;

    try {
      if (
        await g.act('guess', {
          guess: value,
        })
      ) {
        setGuess('');
      }
    } finally {
      submittingGuess.current = false;
    }
  };

  const pointTotal = strokes.reduce(
    (sum, stroke) => sum + stroke.points.length / 2,
    0,
  );

  const bottomPadding = Math.max(
    s.md,
    insets.bottom,
  );

  const openMore = () => {
    if (g.busy || drawing) return;
    setToolPanel(null);
    setConfirmation(null);
    setShowMore(true);
  };

  const moreSheet = (
    <BottomSheet
      visible={showMore}
      title={
        confirmation === 'clear'
          ? 'Pulisci disegno'
          : confirmation === 'reveal'
            ? 'Svela la parola'
            : confirmation === 'cancel'
              ? 'Annulla partita'
              : 'Altre azioni'
      }
      onClose={() => {
        if (g.busy) return;
        setShowMore(false);
        setConfirmation(null);
      }}
    >
      {playing && confirmation ? (
        <>
          <T>
            {confirmation === 'clear'
              ? 'Il disegno verrà cancellato per entrambi. La partita e i tentativi continueranno.'
              : confirmation === 'reveal'
                ? 'Il turno finirà senza vincitore.'
                : 'La partita finirà per entrambi.'}
          </T>

          <Button
            label={
              confirmation === 'clear'
                ? 'Pulisci'
                : confirmation === 'reveal'
                  ? 'Svela'
                  : 'Annulla partita'
            }
            variant="danger"
            loading={g.busy}
            onPress={() => void confirmEnd()}
          />

          <Button
            label="Continua a giocare"
            variant="secondary"
            disabled={g.busy}
            onPress={() => setConfirmation(null)}
          />
        </>
      ) : (
        <>
          {drawer && playing && (
            <>
              <T tone="muted">
                Gestisci il disegno o concludi il turno.
              </T>

              <Button
                label="Pulisci disegno"
                variant="secondary"
                disabled={
                  g.busy ||
                  drawing ||
                  !strokes.length
                }
                onPress={() => setConfirmation('clear')}
              />

              <Button
                label="Svela la parola e termina"
                variant="secondary"
                disabled={g.busy || drawing}
                onPress={() => void requestEnd('reveal')}
              />
            </>
          )}

          <Button
            label="Annulla partita"
            variant="danger"
            disabled={g.busy || drawing}
            onPress={() => void requestEnd('cancel')}
          />
        </>
      )}
    </BottomSheet>
  );

  // ---------------------------------------------
  // DISEGNATORE V2.2
  // ---------------------------------------------

  if (drawer && playing) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          scrollEnabled={!drawing}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: s.md,
            paddingTop: s.md,
            paddingBottom: s.lg,
            gap: s.md,
          }}
        >
          {/* Stato e missione */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: s.sm,
            }}
          >
            <T v="caption" tone="muted">
              Turno in corso
            </T>

            <T v="caption" tone="muted">
              In coppia
            </T>
          </View>

          <View
            style={{
              padding: s.md,
              borderRadius: r.lg,
              backgroundColor: c.surfaceAlt,
              borderWidth: 1,
              borderColor: c.primary,
              gap: 5,
            }}
          >
            <T v="caption" tone="primary" bold>
              TOCCA A TE · DISEGNI TU
            </T>

            <T v="h2">
              {g.secret?.word
                ? `Disegna: ${g.secret.word}`
                : 'Caricamento della parola…'}
            </T>

            <T v="caption" tone="muted">
              Fai indovinare la parola al partner.
              Non scrivere lettere.
            </T>
          </View>

          {g.secretError && (
            <Card>
              <T tone="danger">
                Non riesco a caricare la parola.
              </T>
              <Button
                label="Riprova a caricare la parola"
                variant="secondary"
                onPress={g.retrySecret}
              />
            </Card>
          )}

          {/* Penna, Forme, Gomma */}
          <View style={{ gap: s.sm }}>
            <View
              style={{
                flexDirection: 'row',
                gap: s.sm,
              }}
            >
              <ToolButton
                symbol="✎"
                label="Penna"
                selected={tool === 'draw'}
                disabled={g.busy || drawing}
                onPress={() => setTool('draw')}
              />

              <ToolButton
                symbol="◯"
                label="Forme"
                selected={shapeSelected}
                disabled={g.busy || drawing}
                onPress={() => setTool(lastShape.current)}
              />

              <ToolButton
                symbol="⌫"
                label="Gomma"
                selected={tool === 'eraser'}
                disabled={g.busy || drawing}
                onPress={() => setTool('eraser')}
              />
            </View>

            {/* Forme: mostrate solo quando servono */}
            {shapeSelected && (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: s.sm,
                }}
              >
                {SHAPES.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.label}
                    selected={tool === item.id}
                    onPress={() => {
                      lastShape.current = item.id;
                      setTool(item.id);
                    }}
                  />
                ))}
              </View>
            )}

            {tool === 'eraser' ? (
              <View
                style={{
                  paddingVertical: s.xs,
                }}
              >
                <T v="caption" tone="muted">
                  Gomma attiva · Cancella porzioni
                  dei tuoi tratti.
                </T>
              </View>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: s.sm,
                  }}
                >
                  <T v="caption" tone="muted">
                    Colore · {selectedColor?.label ?? 'Selezionato'}
                  </T>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Modifica spessore del tratto"
                    disabled={g.busy || drawing}
                    onPress={() => setToolPanel('width')}
                    style={{
                      minHeight: MIN_TOUCH,
                      justifyContent: 'center',
                      paddingHorizontal: s.sm,
                    }}
                  >
                    <T
                      v="caption"
                      tone="primary"
                      bold
                    >
                      {width === 3
                        ? 'Fine'
                        : width === 6
                          ? 'Medio'
                          : 'Grande'}{' ›'}
                    </T>
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: s.xs,
                  }}
                >
                  {quickColors.map((item) => (
                    <ColorSwatch
                      key={item.color}
                      color={item.color}
                      label={item.label}
                      selected={color === item.color}
                      onPress={() => setColor(item.color)}
                    />
                  ))}

                  <Button
                    label="Tutti"
                    variant="secondary"
                    small
                    disabled={g.busy || drawing}
                    onPress={() => setToolPanel('colors')}
                  />
                </View>
              </>
            )}
          </View>

          {/* Lavagna: motore originale */}
          <View
            style={{
              borderRadius: r.lg,
              overflow: 'hidden',
              backgroundColor: '#17131F',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Surface
              strokes={strokes}
              onBegin={begin}
              onPoint={point}
              onEnd={end}
              enabled={
                !toolPanel &&
                !showMore &&
                !g.busy
              }
            />
          </View>

          {/* Stato e limiti */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: s.xs,
            }}
          >
            <T v="caption" tone="muted">
              {strokes.length}/60 tratti · {pointTotal}/3000 punti
            </T>

            <T
              v="caption"
              bold
              tone={dirty ? 'primary' : 'success'}
            >
              {g.busy
                ? 'Salvataggio…'
                : dirty
                  ? 'Da salvare'
                  : 'Disegno salvato'}
            </T>
          </View>

          {drawing && (
            <T v="caption" tone="muted">
              Completa il gesto sollevando il dito,
              la penna o il mouse.
            </T>
          )}
        </ScrollView>

        {/* Barra sempre raggiungibile */}
        <View
          style={{
            paddingHorizontal: s.md,
            paddingTop: s.sm,
            paddingBottom: bottomPadding,
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: s.sm,
          }}
        >
          <Button
            label="Salva i tratti"
            onPress={() => void publish()}
            disabled={
              !dirty ||
              drawing ||
              g.busy
            }
            loading={g.busy}
            style={{ flex: 1.3 }}
          />

          <Button
            label="Annulla"
            variant="secondary"
            onPress={undo}
            disabled={
              g.busy ||
              drawing ||
              !strokes.length
            }
            style={{ flex: 1 }}
          />

          <IconButton
            icon="sliders"
            label="Altre azioni"
            onPress={openMore}
          />
        </View>

        {/* Palette realmente definita dal progetto */}
        <BottomSheet
          visible={toolPanel !== null}
          title={
            toolPanel === 'colors'
              ? 'Scegli un colore'
              : 'Spessore del tratto'
          }
          onClose={() => setToolPanel(null)}
        >
          {toolPanel === 'colors' && (
            <View style={{ gap: s.md }}>
              <T tone="muted">
                Scegli un colore per i prossimi tratti.
              </T>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: s.sm,
                }}
              >
                {canvasPalette.map((item) => (
                  <TouchableOpacity
                    key={item.color}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{
                      selected: color === item.color,
                    }}
                    onPress={() => {
                      setColor(item.color);
                      setToolPanel(null);
                    }}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth:
                        color === item.color ? 2 : 0,
                      borderColor: c.primary,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: item.color,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {toolPanel === 'width' && (
            <View style={{ gap: s.sm }}>
              <T tone="muted">
                Scegli lo spessore dei prossimi tratti.
              </T>

              {WIDTHS.map((item) => (
                <Button
                  key={item.value}
                  label={item.label}
                  variant={
                    width === item.value
                      ? 'primary'
                      : 'secondary'
                  }
                  onPress={() => {
                    setWidth(item.value);
                    setToolPanel(null);
                  }}
                />
              ))}
            </View>
          )}
        </BottomSheet>

        {moreSheet}
      </View>
    );
  }

  // ---------------------------------------------
  // INDOVINATORE V2.1
  // ---------------------------------------------

  if (!drawer && playing) {
    const letters = Math.max(
      0,
      Number(m.state.letters) || 0,
    );

    // Solo trattini: nessuna lettera segreta.
    const placeholders = Array.from(
      { length: Math.min(letters, 12) },
      () => '—',
    ).join(' ');

    return (
      <KeyboardAvoidingView
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: s.md,
            paddingTop: s.md,
            paddingBottom: s.lg,
            gap: s.md,
          }}
        >
          {/* Ruolo e tentativi, senza grande card */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: s.sm,
            }}
          >
            <T bold>
              Tocca a te: indovina
            </T>

            <T v="caption" tone="primary" bold>
              {attempts.length}/8 tentativi
            </T>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: s.sm,
            }}
          >
            <T v="caption" tone="muted">
              Parola di {letters} lettere
            </T>

            {!!placeholders && (
              <T
                v="caption"
                tone="primary"
                style={{ letterSpacing: 1 }}
              >
                {placeholders}
              </T>
            )}
          </View>

          {/* Disegno condiviso: più spazio visivo */}
          <View
            accessibilityLabel="Disegno del partner"
            style={{
              width: '100%',
              aspectRatio: 1,
              backgroundColor: '#17131F',
              borderRadius: r.lg,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Drawing strokes={m.state.strokes ?? []} />
          </View>

          <T v="caption" tone="muted">
            Disegno del partner · Si aggiorna durante il turno
          </T>

          {/* Storico visibile solo quando serve */}
          {!!attempts.length && (
            <>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Tentativi precedenti"
                accessibilityState={{
                  expanded: historyOpen,
                }}
                activeOpacity={0.8}
                onPress={() => setHistoryOpen((value) => !value)}
                style={{
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: r.md,
                  padding: s.md,
                  minHeight: MIN_TOUCH,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: s.sm,
                  }}
                >
                  <T bold>
                    Tentativi precedenti ({attempts.length})
                  </T>

                  <T v="caption" tone="primary">
                    {historyOpen ? 'Nascondi' : 'Mostra'}
                  </T>
                </View>
              </TouchableOpacity>

              {historyOpen && (
                <Card>
                  <View style={{ gap: s.sm }}>
                    {attempts.map((attempt, index) => (
                      <T key={`${index}-${attempt}`}>
                        {index + 1}. {attempt}
                      </T>
                    ))}
                  </View>
                </Card>
              )}
            </>
          )}
        </ScrollView>

        {/* Risposta fissa sotto la lavagna */}
        <View
          style={{
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.border,
            paddingHorizontal: s.md,
            paddingTop: s.md,
            paddingBottom: bottomPadding,
            gap: s.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: s.sm,
            }}
          >
            <T bold>
              La tua risposta
            </T>

            <T v="caption" tone="primary">
              {remaining} tentativi rimasti
            </T>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: s.sm,
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Input
                accessibilityLabel="La tua risposta"
                placeholder="Scrivi la parola…"
                value={guess}
                onChangeText={setGuess}
                maxLength={40}
                editable={
                  !g.busy &&
                  remaining > 0
                }
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={() => void submitGuess()}
              />
            </View>

            <Button
              label="Indovina"
              loading={g.busy}
              disabled={
                !guess.trim() ||
                g.busy ||
                remaining === 0
              }
              onPress={() => void submitGuess()}
              style={{ minWidth: 105 }}
            />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Altre azioni della partita"
            onPress={openMore}
            style={{
              alignSelf: 'flex-end',
              minHeight: MIN_TOUCH,
              justifyContent: 'center',
              paddingHorizontal: s.xs,
            }}
          >
            <T v="caption" tone="primary">
              Altre azioni ···
            </T>
          </TouchableOpacity>
        </View>

        {moreSheet}
      </KeyboardAvoidingView>
    );
  }

  // ---------------------------------------------
  // TURNO TERMINATO / ANNULLATO
  // ---------------------------------------------

  return (
    <>
      <MatchStatus
        match={m}
        userId={g.d.userId}
      />

      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          backgroundColor: '#17131F',
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <Drawing strokes={m.state.strokes ?? []} />
      </View>

      {!!attempts.length && (
        <Card>
          <T bold>Tentativi</T>
          <T>{attempts.join(' · ')}</T>
        </Card>
      )}

      <T v="title">
        {m.state.answer
          ? `La parola era: ${m.state.answer}`
          : 'Turno annullato'}
      </T>

      <Button
        label="Nuovo turno: scambiate i ruoli"
        loading={g.busy}
        onPress={() => void g.start()}
      />
    </>
  );
}

export function DrawGuessScreen() {
  const g = usePartnerGame('drawguess');

  const [drawing, setDrawing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const activeRound =
    !!g.match &&
    g.match.status === 'playing';

  const helpButton = (
    <IconButton
      icon="helpCircle"
      label="Come si gioca"
      onPress={() => setShowHelp(true)}
    />
  );

  const helpSheet = (
    <BottomSheet
      visible={showHelp}
      title="Come si gioca"
      onClose={() => setShowHelp(false)}
      footer={
        <Button
          label="Ho capito"
          onPress={() => setShowHelp(false)}
        />
      }
    >
      <T>
        Uno di voi disegna una parola segreta senza
        usare lettere. L&apos;altro prova a indovinare.
      </T>

      <T tone="muted">
        Il partner ha otto tentativi.
        Potete continuare il turno anche tornando
        nell&apos;app più tardi.
      </T>

      <T tone="muted">
        Chi disegna può scegliere i colori della palette,
        tre spessori, la gomma e le forme:
        linea, rettangolo e cerchio.
      </T>

      <T tone="muted">
        Il disegno viene salvato dopo ogni gesto.
        «Salva i tratti» permette di riprovare
        quando ci sono modifiche non salvate.
      </T>
    </BottomSheet>
  );

  // Entrambi i ruoli hanno un footer fisso.
  if (activeRound && !g.loading && !g.error) {
    return (
      <Screen
        scroll={false}
        contentStyle={{
          padding: 0,
          paddingBottom: 0,
          gap: 0,
        }}
        header={
          <Header
            title="Disegna e indovina"
            right={helpButton}
            onBack={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/game');
              }
            }}
          />
        }
      >
        <DrawingRound
          key={g.match!.id}
          g={g}
          onDrawing={setDrawing}
        />

        {helpSheet}
      </Screen>
    );
  }

  // Nuova partita, caricamento, errori, fine turno.
  return (
    <FeatureFrame
      title="Disegna e indovina"
      headerRight={helpButton}
      error={g.error}
      loading={g.loading}
      onRefresh={g.refresh}
      scrollEnabled={!drawing}
    >
      <T>
        Una parola segreta, un disegno e otto tentativi.
        Potete continuare il turno anche tornando
        più tardi.
      </T>

      {g.secretError && (
        <>
          <T tone="danger">
            Non riesco a caricare la parola.
            Controlla la connessione e riprova.
          </T>

          <Button
            label="Riprova a caricare la parola"
            variant="secondary"
            onPress={g.retrySecret}
          />
        </>
      )}

      {g.match ? (
        <DrawingRound
          key={g.match.id}
          g={g}
          onDrawing={setDrawing}
        />
      ) : (
        <Button
          label="Invita il partner: disegno io"
          loading={g.busy}
          onPress={() => void g.start()}
        />
      )}

      {helpSheet}
    </FeatureFrame>
  );
}
