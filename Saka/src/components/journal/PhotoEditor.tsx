import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polygon, Rect as SvgRect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';
import {
  ACCENT_GOLD,
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  BORDER_GOLD,
  BORDER_SUBTLE,
  RADIUS_BTN,
  RADIUS_CARD,
  TEXT_DANGER,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

type Point = { x: number; y: number };
type Tool = 'pen' | 'erase' | 'text' | 'arrow' | 'rect' | 'circle';
type TextItem = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};
type Item =
  | { id: string; type: 'stroke'; points: Point[]; color: string; width: number }
  | { id: string; type: 'shape'; shape: 'arrow' | 'rect' | 'circle'; a: Point; b: Point; color: string; width: number }
  | TextItem;

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  onSave: (editedUri: string) => Promise<{ error: string | null }>;
}

const COLORS = ['#FFFFFF', '#0E1520', '#C9A96E', '#E07070', '#6FAF8A', '#5B8DEF', '#E8A33D', '#B266FF'];
const WIDTHS = [2, 4, 6, 10, 16];
const TEXT_SIZES = [16, 22, 28, 36];
const MAX_HISTORY = 50;
const MAX_EXPORT_SIDE = 2048;
const PANEL_W = 236; // landscape tool panel width
const MARGIN_X = 14; // gap between the dialog and the screen edge (portrait)
const MARGIN_X_LS = 24; // (landscape)
const MARGIN_Y_LS = 12;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function PhotoEditor({ visible, uri, onClose, onSave }: Props) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = windowW > windowH;
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[2]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [hist, setHist] = useState<{ stack: Item[][]; index: number }>({ stack: [[]], index: 0 });
  const [draft, setDraftState] = useState<Item | null>(null);
  const [pendingTextPoint, setPendingTextPoint] = useState<Point | null>(null);
  const [pendingTextValue, setPendingTextValue] = useState('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const items = hist.stack[hist.index];
  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.stack.length - 1;
  const canvasRef = useRef<View>(null);
  const draftRef = useRef<Item | null>(null);
  const setDraft = (d: Item | null) => {
    draftRef.current = d;
    setDraftState(d);
  };

  useEffect(() => {
    if (!visible || !uri) return;
    setImageSize(null);
    setLoadFailed(false);
    setHist({ stack: [[]], index: 0 });
    setDraft(null);
    setTool('pen');
    Image.getSize(
      uri,
      (w, h) => setImageSize({ w, h }),
      () => setLoadFailed(true),
    );
  }, [visible, uri]);

  const canvasSize = useMemo(() => {
    if (!imageSize) return { width: 0, height: 0 };
    const cardW = windowW - insets.left - insets.right - 2 * (landscape ? MARGIN_X_LS : MARGIN_X);
    const cardH = windowH - insets.top - insets.bottom - 2 * MARGIN_Y_LS;
    const maxW = landscape ? cardW - PANEL_W - 26 : Math.min(cardW, 640) - 26;
    const maxH = landscape ? cardH - 26 : windowH * 0.5;
    const ratio = imageSize.w / imageSize.h;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [imageSize, windowW, windowH, landscape, insets.left, insets.right, insets.top, insets.bottom]);

  const live = useRef({ items, tool, color, width, canvas: canvasSize });
  live.current = { items, tool, color, width, canvas: canvasSize };

  const commit = (fn: (current: Item[]) => Item[]) => {
    setHist((h) => {
      const cur = h.stack[h.index];
      const next = fn(cur);
      if (next === cur) return h;
      const stack = [...h.stack.slice(0, h.index + 1), next].slice(-MAX_HISTORY);
      return { stack, index: stack.length - 1 };
    });
  };

  const undo = () => setHist((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
  const redo = () => setHist((h) => ({ ...h, index: Math.min(h.stack.length - 1, h.index + 1) }));

  const clearAll = () => {
    Alert.alert('Clear all edits?', 'This removes every mark on this photo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => commit((cur) => (cur.length ? [] : cur)) },
    ]);
  };

  const requestClose = () => {
    if (isSaving) return;
    if (items.length === 0) {
      onClose();
      return;
    }
    Alert.alert('Discard edits?', 'Your changes to this photo will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { canvas, tool: t, color: c, width: w, items: its } = live.current;
      const p = clampPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, canvas);

      if (t === 'text') {
        setPendingTextPoint(p);
        setPendingTextValue('');
        setEditingTextId(null);
        return;
      }
      if (t === 'erase') {
        const hitId = hitTest(its, p);
        if (hitId) commit((cur) => cur.filter((i) => i.id !== hitId));
        return;
      }
      if (t === 'pen') {
        setDraft({ id: uid(), type: 'stroke', points: [p], color: c, width: w });
      } else {
        setDraft({ id: uid(), type: 'shape', shape: t, a: p, b: p, color: c, width: w });
      }
    },
    onPanResponderMove: (e) => {
      const { canvas, tool: t, items: its } = live.current;
      const p = clampPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, canvas);
      if (t === 'erase') {
        const hitId = hitTest(its, p);
        if (hitId) commit((cur) => (cur.some((i) => i.id === hitId) ? cur.filter((i) => i.id !== hitId) : cur));
        return;
      }
      const d = draftRef.current;
      if (!d) return;
      if (d.type === 'stroke') setDraft({ ...d, points: [...d.points, p] });
      else if (d.type === 'shape') setDraft({ ...d, b: p });
    },
    onPanResponderRelease: () => {
      const d = draftRef.current;
      setDraft(null);
      if (!d) return;
      if (d.type === 'stroke') {
        const finalStroke = d.points.length === 1 ? { ...d, points: [d.points[0], d.points[0]] } : d;
        commit((cur) => [...cur, finalStroke]);
      } else if (d.type === 'shape' && Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) >= 4) {
        commit((cur) => [...cur, d]);
      }
    },
    onPanResponderTerminate: () => setDraft(null),
  })).current;

  const confirmTextEntry = () => {
    const text = pendingTextValue.trim();
    const editId = editingTextId;
    const point = pendingTextPoint;
    setPendingTextPoint(null);
    setEditingTextId(null);
    if (!text) return;

    if (editId) {
      commit((cur) => cur.map((i) => (i.id === editId && i.type === 'text' ? { ...i, text } : i)));
    } else if (point) {
      commit((cur) => [...cur, { id: uid(), type: 'text', x: point.x, y: point.y, text, color, fontSize: textSize }]);
    }
  };

  const editExistingText = (item: TextItem) => {
    setEditingTextId(item.id);
    setPendingTextValue(item.text);
    setPendingTextPoint({ x: item.x, y: item.y });
  };

  const handleSave = async () => {
    if (!canvasRef.current || isSaving || !imageSize || loadFailed) return;
    setIsSaving(true);
    try {
      const scale = Math.min(1, MAX_EXPORT_SIDE / Math.max(imageSize.w, imageSize.h));
      const out = await captureRef(canvasRef.current, {
        format: 'jpg',
        quality: 0.92,
        width: Math.round(imageSize.w * scale),
        height: Math.round(imageSize.h * scale),
      });
      const result = await onSave(out);
      if (result?.error) Alert.alert('Save failed', result.error);
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Unable to save edited photo.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderedItems = draft ? [...items, draft] : items;
  const saveDisabled = isSaving || loadFailed || !imageSize;

  // ── pieces shared by the portrait toolbar and the landscape side panel ──
  const cancelBtn = (
    <TouchableOpacity onPress={requestClose} style={styles.headerBtn} hitSlop={8}>
      <Ionicons name="close" size={18} color={TEXT_PRIMARY} />
      <Text style={styles.headerBtnText}>Cancel</Text>
    </TouchableOpacity>
  );

  const saveBtn = (
    <TouchableOpacity
      onPress={handleSave}
      disabled={saveDisabled}
      style={[styles.saveHeaderBtn, saveDisabled && { opacity: 0.5 }]}
      hitSlop={8}
    >
      {isSaving ? (
        <ActivityIndicator size="small" color={BG_PANEL} />
      ) : (
        <>
          <Ionicons name="checkmark" size={16} color={BG_PANEL} />
          <Text style={styles.saveHeaderBtnText}>Save</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const toolButtons = (compact: boolean) => (
    <>
      <ToolButton compact={compact} icon="pencil" label="Pen" active={tool === 'pen'} onPress={() => setTool('pen')} />
      <ToolButton compact={compact} icon="text" label="Text" active={tool === 'text'} onPress={() => setTool('text')} />
      <ToolButton compact={compact} icon="arrow-forward" label="Arrow" active={tool === 'arrow'} onPress={() => setTool('arrow')} />
      <ToolButton compact={compact} icon="square-outline" label="Rect" active={tool === 'rect'} onPress={() => setTool('rect')} />
      <ToolButton compact={compact} icon="ellipse-outline" label="Circle" active={tool === 'circle'} onPress={() => setTool('circle')} />
      <ToolButton compact={compact} icon="backspace-outline" label="Erase" active={tool === 'erase'} onPress={() => setTool('erase')} />
    </>
  );

  const colorSwatches = (size: number) =>
    COLORS.map((c) => (
      <TouchableOpacity
        key={c}
        onPress={() => setColor(c)}
        style={[styles.colorSwatch, { width: size, height: size, borderRadius: size / 2, backgroundColor: c }, color === c && styles.colorSwatchActive]}
        accessibilityRole="button"
        accessibilityLabel={`Color ${c}`}
      />
    ));

  const widthChips = WIDTHS.map((w) => (
    <TouchableOpacity key={w} onPress={() => setWidth(w)} style={[styles.widthChip, width === w && styles.widthChipActive]}>
      <View style={{ width: 18, height: w, borderRadius: w / 2, backgroundColor: width === w ? ACCENT_GOLD : TEXT_MUTED }} />
    </TouchableOpacity>
  ));

  const historyButtons = (
    <>
      <TouchableOpacity onPress={undo} style={styles.miniBtn} disabled={!canUndo}>
        <Ionicons name="arrow-undo" size={16} color={canUndo ? TEXT_PRIMARY : TEXT_FAINT} />
      </TouchableOpacity>
      <TouchableOpacity onPress={redo} style={styles.miniBtn} disabled={!canRedo}>
        <Ionicons name="arrow-redo" size={16} color={canRedo ? TEXT_PRIMARY : TEXT_FAINT} />
      </TouchableOpacity>
      <TouchableOpacity onPress={clearAll} style={styles.miniBtn}>
        <Ionicons name="trash-outline" size={16} color={TEXT_DANGER} />
      </TouchableOpacity>
    </>
  );

  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible={visible}
      animationType="fade"
      onRequestClose={requestClose}
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + (landscape ? MARGIN_Y_LS : 16),
            paddingBottom: insets.bottom + (landscape ? MARGIN_Y_LS : 16),
            paddingLeft: insets.left + (landscape ? MARGIN_X_LS : MARGIN_X),
            paddingRight: insets.right + (landscape ? MARGIN_X_LS : MARGIN_X),
          },
        ]}
      >
        <ModalScrim color="rgba(0,0,0,0.74)" />
        {/* tap outside the dialog = close (asks before discarding edits) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessible={false} />
        <View style={[styles.card, landscape && styles.cardLs]}>
        {!landscape && (
          <View style={styles.header}>
            {cancelBtn}
            <Text style={styles.headerTitle}>Edit photo</Text>
            {saveBtn}
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.canvasArea, landscape && styles.canvasAreaLs]}>
          {loadFailed ? (
            <View style={styles.errorBox}>
              <Ionicons name="image-outline" size={24} color={TEXT_MUTED} />
              <Text style={styles.errorText}>Couldn't load this photo, so it can't be edited.</Text>
            </View>
          ) : (
            <View style={styles.canvasClip}>
              <View
                ref={canvasRef}
                collapsable={false}
                style={{ width: canvasSize.width, height: canvasSize.height, backgroundColor: '#000' }}
              >
                {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                <Svg style={StyleSheet.absoluteFill} width={canvasSize.width} height={canvasSize.height}>
                  {renderedItems.map((item) => renderSvgItem(item))}
                </Svg>
                <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
                {items.map((item) => item.type === 'text' ? (
                  <DraggableText
                    key={item.id}
                    item={item}
                    interactive={tool === 'text'}
                    maxX={canvasSize.width}
                    maxY={canvasSize.height}
                    onDragEnd={(nx, ny) => commit((cur) => cur.map((i) => (i.id === item.id ? { ...i, x: nx, y: ny } : i)))}
                    onTapEdit={() => editExistingText(item)}
                    onLongPressDelete={() => Alert.alert('Remove text?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => commit((cur) => cur.filter((i) => i.id !== item.id)) },
                    ])}
                  />
                ) : null)}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>

        {landscape ? (
          // LANDSCAPE: the photo gets the full height; every control lives in this side panel
          <ScrollView
            style={styles.panel}
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.panelTop}>
              {cancelBtn}
              {saveBtn}
            </View>
            <View style={styles.toolGrid}>{toolButtons(true)}</View>
            <View style={styles.panelColors}>{colorSwatches(22)}</View>
            <View style={styles.toolRow}>{widthChips}</View>
            <View style={styles.panelActions}>{historyButtons}</View>
          </ScrollView>
        ) : (
          <View style={styles.toolbarWrap}>
            <View style={styles.toolRow}>{toolButtons(false)}</View>
            <View style={styles.toolRow}>
              <View style={styles.colorRow}>{colorSwatches(26)}</View>
            </View>
            <View style={styles.toolRow}>
              {widthChips}
              <View style={{ flex: 1 }} />
              {historyButtons}
            </View>
          </View>
        )}

        <Modal
          {...FULLSCREEN_MODAL_PROPS}
          visible={pendingTextPoint !== null}
          animationType="fade"
          onRequestClose={() => {
            setPendingTextPoint(null);
            setEditingTextId(null);
          }}
        >
          <ModalScrim color="rgba(0,0,0,0.65)" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.textModalRoot,
              {
                paddingLeft: insets.left + 24,
                paddingRight: insets.right + 24,
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <View style={[styles.textModalCard, landscape && styles.textModalCardLs]}>
              <View style={landscape ? styles.textModalMainLs : styles.textModalMain}>
                <Text style={styles.textModalLabel}>{editingTextId ? 'Edit text' : 'Add text'}</Text>
                <TextInput
                  autoFocus
                  value={pendingTextValue}
                  onChangeText={setPendingTextValue}
                  placeholder="Summit at sunrise…"
                  placeholderTextColor={TEXT_FAINT}
                  style={styles.textModalInput}
                  multiline
                />
              </View>
              <View style={landscape ? styles.textModalSideLs : styles.textModalMain}>
                <View style={styles.textSizeRow}>
                  {TEXT_SIZES.map((s) => (
                    <TouchableOpacity key={s} onPress={() => setTextSize(s)} style={[styles.textSizeChip, textSize === s && styles.textSizeChipActive]}>
                      <Text style={{ color: textSize === s ? ACCENT_GOLD : TEXT_MUTED, fontSize: Math.min(18, s), fontWeight: '700' }}>A</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.textModalActions}>
                  <TouchableOpacity onPress={() => { setPendingTextPoint(null); setEditingTextId(null); }} style={[styles.textModalBtn, { backgroundColor: BG_SUBTLE }]}>
                    <Text style={styles.textModalBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmTextEntry} style={[styles.textModalBtn, { backgroundColor: ACCENT_GOLD }]}>
                    <Text style={[styles.textModalBtnText, { color: BG_PANEL }]}>{editingTextId ? 'Update' : 'Add'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        </View>
      </View>
    </Modal>
  );
}

function clampPoint(x: number, y: number, canvas: { width: number; height: number }): Point {
  return { x: Math.max(0, Math.min(canvas.width, x)), y: Math.max(0, Math.min(canvas.height, y)) };
}

function renderSvgItem(item: Item) {
  if (item.type === 'stroke') {
    return (
      <Path key={item.id} d={strokeToPath(item.points)} stroke={item.color} strokeWidth={item.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    );
  }
  if (item.type === 'shape') {
    const { a, b, shape, color: c, width: w } = item;
    if (shape === 'rect') {
      return (
        <SvgRect key={item.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} stroke={c} strokeWidth={w} fill="none" />
      );
    }
    if (shape === 'circle') {
      return (
        <Circle key={item.id} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) / 2)} stroke={c} strokeWidth={w} fill="none" />
      );
    }
    const { line, head } = arrowGeometry(a, b, w);
    return (
      <React.Fragment key={item.id}>
        <Line x1={a.x} y1={a.y} x2={line.x} y2={line.y} stroke={c} strokeWidth={w} strokeLinecap="round" />
        <Polygon points={head} fill={c} />
      </React.Fragment>
    );
  }
  return null;
}

function strokeToPath(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}

function arrowGeometry(a: Point, b: Point, width: number) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const headLen = Math.max(12, width * 3.5);
  const headWidth = Math.max(10, width * 2.8);
  const baseX = b.x - headLen * Math.cos(angle);
  const baseY = b.y - headLen * Math.sin(angle);
  const perpX = Math.sin(angle);
  const perpY = -Math.cos(angle);
  const leftX = baseX + (headWidth / 2) * perpX;
  const leftY = baseY + (headWidth / 2) * perpY;
  const rightX = baseX - (headWidth / 2) * perpX;
  const rightY = baseY - (headWidth / 2) * perpY;
  return { line: { x: baseX, y: baseY }, head: `${b.x},${b.y} ${leftX},${leftY} ${rightX},${rightY}` };
}

function hitTest(items: Item[], p: Point): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.type === 'stroke') {
      for (const pt of item.points) {
        if (Math.hypot(pt.x - p.x, pt.y - p.y) < 14) return item.id;
      }
    } else if (item.type === 'shape') {
      const { a, b, shape } = item;
      if (shape === 'rect') {
        const x0 = Math.min(a.x, b.x);
        const y0 = Math.min(a.y, b.y);
        const x1 = Math.max(a.x, b.x);
        const y1 = Math.max(a.y, b.y);
        if (p.x >= x0 - 8 && p.x <= x1 + 8 && p.y >= y0 - 8 && p.y <= y1 + 8) return item.id;
      } else if (shape === 'circle') {
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const r = Math.hypot(b.x - a.x, b.y - a.y) / 2;
        if (Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) < 12) return item.id;
      } else if (distToSegment(p, a, b) < 14) {
        return item.id;
      }
    }
  }
  return null;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function DraggableText({ item, interactive, maxX, maxY, onDragEnd, onTapEdit, onLongPressDelete }: {
  item: TextItem;
  interactive: boolean;
  maxX: number;
  maxY: number;
  onDragEnd: (x: number, y: number) => void;
  onTapEdit: () => void;
  onLongPressDelete: () => void;
}) {
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const latest = useRef({ item, maxX, maxY, onDragEnd, onTapEdit, onLongPressDelete });
  latest.current = { item, maxX, maxY, onDragEnd, onTapEdit, onLongPressDelete };
  const moved = useRef(false);
  const longPressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clearTimer, []);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      moved.current = false;
      longPressed.current = false;
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        if (!moved.current) {
          longPressed.current = true;
          latest.current.onLongPressDelete();
        }
      }, 600);
    },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) {
        moved.current = true;
        clearTimer();
        setDrag({ dx: g.dx, dy: g.dy });
      }
    },
    onPanResponderRelease: (_, g) => {
      clearTimer();
      const { item: it, maxX: mx, maxY: my } = latest.current;
      if (longPressed.current) return;
      if (moved.current) {
        const nx = Math.max(0, Math.min(mx, it.x + g.dx));
        const ny = Math.max(0, Math.min(my, it.y + g.dy));
        latest.current.onDragEnd(nx, ny);
        setDrag({ dx: 0, dy: 0 });
      } else {
        latest.current.onTapEdit();
      }
    },
    onPanResponderTerminate: () => {
      clearTimer();
      setDrag({ dx: 0, dy: 0 });
    },
  })).current;

  return (
    <View {...pan.panHandlers} pointerEvents={interactive ? 'auto' : 'none'} style={[styles.textOverlay, { left: item.x + drag.dx, top: item.y + drag.dy }]}>
      <Text style={{ color: item.color, fontSize: item.fontSize, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }}>
        {item.text}
      </Text>
    </View>
  );
}

function ToolButton({ icon, label, active, onPress, compact = false }: { icon: any; label: string; active: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.toolBtn, compact && styles.toolBtnCompact, active && styles.toolBtnActive]} activeOpacity={0.8}>
      <Ionicons name={icon} size={compact ? 14 : 16} color={active ? ACCENT_GOLD : TEXT_MUTED} />
      <Text style={[styles.toolBtnLabel, compact && styles.toolBtnLabelCompact, active && { color: ACCENT_GOLD }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_PANEL },
  // the editor is a floating dialog over a dimmed backdrop, not a full screen
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 640, overflow: 'hidden', borderRadius: RADIUS_CARD + 4, borderWidth: 1, borderColor: BORDER_GOLD, backgroundColor: BG_PANEL },
  cardLs: { flex: 1, maxWidth: 1200, flexDirection: 'row' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingRight: 6 },
  headerBtnText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  saveHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: ACCENT_GOLD },
  saveHeaderBtnText: { color: BG_PANEL, fontSize: 12, fontWeight: '800' },
  canvasArea: { alignItems: 'center', justifyContent: 'center', padding: 12, minHeight: 160 },
  canvasAreaLs: { flex: 1, minHeight: 0 },
  canvasClip: { borderRadius: RADIUS_CARD, overflow: 'hidden' },
  errorBox: { alignItems: 'center', gap: 8, padding: 24 },
  errorText: { color: TEXT_MUTED, fontSize: 12, textAlign: 'center' },
  textOverlay: { position: 'absolute', paddingHorizontal: 4, paddingVertical: 2 },
  toolbarWrap: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: 12, gap: 8, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, backgroundColor: BG_PANEL },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: BORDER_SUBTLE, backgroundColor: BG_CARD },
  toolBtnActive: { borderColor: BORDER_GOLD, backgroundColor: 'rgba(201,169,110,0.12)' },
  toolBtnLabel: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700' },
  toolBtnCompact: { flexGrow: 1, flexBasis: '30%', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 6, gap: 4 },
  toolBtnLabelCompact: { fontSize: 10 },
  // ── landscape side panel ──
  panel: { width: PANEL_W, borderLeftWidth: 1, borderLeftColor: BORDER_DEFAULT, backgroundColor: BG_PANEL },
  panelContent: { flexGrow: 1, justifyContent: 'space-between', padding: 10, gap: 8 },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  panelColors: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  panelActions: { flexDirection: 'row', alignItems: 'center' },
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  colorSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  colorSwatchActive: { borderColor: ACCENT_GOLD, borderWidth: 3 },
  widthChip: { width: 30, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: BORDER_SUBTLE },
  widthChipActive: { borderColor: BORDER_GOLD, backgroundColor: 'rgba(201,169,110,0.1)' },
  miniBtn: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: BORDER_SUBTLE, backgroundColor: BG_CARD, marginLeft: 4 },
  textModalRoot: { flex: 1, justifyContent: 'center' },
  textModalCard: { backgroundColor: BG_CARD, borderRadius: RADIUS_CARD, borderWidth: 1, borderColor: BORDER_SUBTLE, padding: 16, gap: 12 },
  textModalLabel: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  textModalInput: { color: TEXT_PRIMARY, backgroundColor: BG_SUBTLE, borderRadius: RADIUS_BTN, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  textSizeRow: { flexDirection: 'row', gap: 8 },
  textSizeChip: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: BORDER_SUBTLE },
  textSizeChipActive: { borderColor: BORDER_GOLD, backgroundColor: 'rgba(201,169,110,0.1)' },
  textModalCardLs: { flexDirection: 'row', alignItems: 'stretch', gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  textModalMain: { gap: 12 },
  textModalMainLs: { flex: 1, gap: 8 },
  textModalSideLs: { width: 190, justifyContent: 'space-between', gap: 10 },
  textModalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  textModalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS_BTN },
  textModalBtnText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '800' },
});