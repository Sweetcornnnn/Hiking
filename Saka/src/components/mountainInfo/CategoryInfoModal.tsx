import React, { Children, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SceneFrame, withAlpha } from './scenes/Primitives';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';
import {
  BG_CARD,
  BG_PANEL,
  BG_SUBTLE,
  BORDER_DEFAULT,
  TEXT_FAINT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../theme/designTokens';

interface CategoryInfoModalProps {
  visible: boolean;
  title: string;
  subtitle: string;
  accent: string;
  /** The same animated scene as the tile, shown small in the header. Leave out for a plain text header. */
  scene?: ReactNode;
  onClose: () => void;
  /**
   * Fit mode: no measuring, paging, arrows or swiping. The children are drawn once, as a
   * single layout that must fit by itself (the panel grows to its content, up to the screen).
   */
  fit?: boolean;
  /** Each top-level child is one entry; entries are paged, never scrolled. */
  children: ReactNode;
}

// Fixed chrome sizes, so the page capacity can be worked out without a second layout pass.
const MAX_PANEL_WIDTH = 620;
const MAX_FIT_PANEL_WIDTH = 960;
const MAX_PANEL_HEIGHT = 460;
const OUTER_PADDING_X = 20;
const OUTER_PADDING_Y = 24;
const BORDER = 1;
const HEADER_HEIGHT = 86;
const HEADER_HEIGHT_PLAIN = 64;
const PAGER_HEIGHT = 50;
const BODY_PAD_X = 18;
const BODY_PAD_TOP = 4;
const BODY_PAD_BOTTOM = 14;
const SWIPE_DISTANCE = 40;

const entryKey = (entry: ReactNode, index: number) =>
  (React.isValidElement(entry) && entry.key != null ? String(entry.key) : String(index));

/**
 * Detail popup. It never scrolls: entries are measured, packed into pages that fit the
 * available height, and flipped with arrows, dots or a horizontal swipe.
 */
export default function CategoryInfoModal({
  visible,
  title,
  subtitle,
  accent,
  scene,
  onClose,
  fit = false,
  children,
}: CategoryInfoModalProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const entries = useMemo(() => Children.toArray(children), [children]);

  const maxPanelWidth = fit ? MAX_FIT_PANEL_WIDTH : MAX_PANEL_WIDTH;
  const panelWidth = Math.min(winW - OUTER_PADDING_X * 2, maxPanelWidth);
  const panelHeight = Math.min(winH - OUTER_PADDING_Y * 2, MAX_PANEL_HEIGHT);

  const headerHeight = scene ? HEADER_HEIGHT : HEADER_HEIGHT_PLAIN;

  // Room for entries when there is no pager, and when there is one.
  const chrome = BORDER * 2 + headerHeight + BODY_PAD_TOP + BODY_PAD_BOTTOM;
  const roomNoPager = panelHeight - chrome;
  const roomWithPager = roomNoPager - PAGER_HEIGHT;

  const [heights, setHeights] = useState<number[]>([]);
  const onMeasure = useCallback((index: number, e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setHeights((prev) => {
      if (prev[index] === h) return prev;
      const next = prev.slice();
      next[index] = h;
      return next;
    });
  }, []);

  const measured = entries.length > 0 && entries.every((_, i) => heights[i] != null);

  const pages = useMemo(() => {
    if (!measured) return [entries.map((_, i) => i)];
    const total = entries.reduce((sum, _, i) => sum + heights[i], 0);
    if (total <= roomNoPager) return [entries.map((_, i) => i)];

    const out: number[][] = [];
    let current: number[] = [];
    let used = 0;
    entries.forEach((_, i) => {
      const h = heights[i];
      if (current.length > 0 && used + h > roomWithPager) {
        out.push(current);
        current = [];
        used = 0;
      }
      current.push(i);
      used += h;
    });
    if (current.length > 0) out.push(current);
    return out;
  }, [measured, entries, heights, roomNoPager, roomWithPager]);

  const paged = pages.length > 1;
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, pages.length - 1);

  useEffect(() => {
    if (visible) setPage(0);
  }, [visible]);

  const go = useCallback(
    (delta: number) => setPage((p) => Math.max(0, Math.min(pages.length - 1, p + delta))),
    [pages.length],
  );

  const touchX = useRef<number | null>(null);

  // A single page only needs its own height; a paged panel keeps one steady size.
  const singleHeight = measured
    ? Math.min(
        panelHeight,
        chrome + entries.reduce((sum, _, i) => sum + heights[i], 0),
      )
    : panelHeight;
  const height = fit ? undefined : paged ? panelHeight : singleHeight;

  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ModalScrim color="rgba(4,8,13,0.72)" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        />
        <View
          style={[
            styles.panel,
            { width: panelWidth, height, maxHeight: panelHeight, borderColor: withAlpha(accent, 0.35) },
          ]}
        >
          <View style={[styles.header, { height: headerHeight }, !scene && styles.headerPlain]}>
            {scene ? (
              <SceneFrame accent={accent} style={styles.thumb}>
                {scene}
              </SceneFrame>
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
            >
              <Ionicons name="close" size={20} color={TEXT_MUTED} />
            </Pressable>
          </View>

          <View
            style={fit ? styles.bodyFit : styles.body}
            onTouchStart={(e) => { touchX.current = e.nativeEvent.pageX; }}
            onTouchEnd={(e) => {
              if (!paged || touchX.current == null) return;
              const dx = e.nativeEvent.pageX - touchX.current;
              touchX.current = null;
              if (dx <= -SWIPE_DISTANCE) go(1);
              else if (dx >= SWIPE_DISTANCE) go(-1);
            }}
          >
            {pages[safePage].map((i) => (
              <View key={entryKey(entries[i], i)}>{entries[i]}</View>
            ))}
          </View>

          {paged ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => go(-1)}
                disabled={safePage === 0}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.pagerButton,
                  safePage === 0 && styles.pagerButtonOff,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Previous page"
              >
                <Ionicons name="chevron-back" size={16} color={accent} />
              </Pressable>

              <View style={styles.dots} accessible accessibilityLabel={`Page ${safePage + 1} of ${pages.length}`}>
                {pages.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === safePage
                        ? { backgroundColor: accent, width: 18 }
                        : { backgroundColor: withAlpha(accent, 0.28) },
                    ]}
                  />
                ))}
              </View>

              <Pressable
                onPress={() => go(1)}
                disabled={safePage === pages.length - 1}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.pagerButton,
                  safePage === pages.length - 1 && styles.pagerButtonOff,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Next page"
              >
                <Ionicons name="chevron-forward" size={16} color={accent} />
              </Pressable>
            </View>
          ) : null}

          {fit ? null : (
            <>
          {/* Invisible copy of every entry, used only to read each one's height. */}
          <View style={styles.measurer} pointerEvents="none">
            {entries.map((entry, i) => (
              <View key={entryKey(entry, i)} onLayout={(e) => onMeasure(i, e)}>
                {entry}
              </View>
            ))}
          </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: OUTER_PADDING_X,
    paddingVertical: OUTER_PADDING_Y,
    backgroundColor: 'transparent',
  },
  panel: {
    borderRadius: 20,
    borderWidth: BORDER,
    backgroundColor: BG_CARD,
    overflow: 'hidden',
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    backgroundColor: BG_PANEL,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DEFAULT,
  },
  headerPlain: {
    paddingLeft: 20,
  },
  thumb: {
    width: 96,
    height: 62,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  subtitle: {
    color: TEXT_FAINT,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },
  body: {
    flex: 1,
    paddingHorizontal: BODY_PAD_X,
    paddingTop: BODY_PAD_TOP,
    paddingBottom: BODY_PAD_BOTTOM,
    overflow: 'hidden',
  },
  bodyFit: {
    paddingHorizontal: BODY_PAD_X,
    paddingTop: BODY_PAD_TOP,
    paddingBottom: BODY_PAD_BOTTOM,
    overflow: 'hidden',
  },
  pager: {
    height: PAGER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DEFAULT,
    backgroundColor: BG_PANEL,
  },
  pagerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SUBTLE,
  },
  pagerButtonOff: {
    opacity: 0.3,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  measurer: {
    position: 'absolute',
    top: 0,
    left: BODY_PAD_X,
    right: BODY_PAD_X,
    opacity: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});