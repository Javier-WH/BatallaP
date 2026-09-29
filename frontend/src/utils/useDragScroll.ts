import { useRef, useCallback, useEffect } from 'react';

/**
 * Enables click-and-drag scrolling on a horizontal container, hiding the
 * native scrollbar. Distinguishes clicks from drags so child onClick handlers
 * still work: a press that moves less than `CLICK_THRESHOLD` px is treated as
 * a click; anything beyond that is a drag and the click is suppressed.
 *
 * Mouse only: on touch devices the native `overflow-x` scroll already works
 * (React touch listeners are passive anyway), and manually setting scrollLeft
 * on touchmove double-scrolls and chains the gesture into the page scroll.
 */
const CLICK_THRESHOLD = 5;

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const state = useRef({
    isDown: false,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    // Prevent text selection / image dragging when starting a drag
    e.preventDefault();
    state.current.isDown = true;
    state.current.dragged = false;
    state.current.startX = e.pageX - el.offsetLeft;
    state.current.startScrollLeft = el.scrollLeft;
    el.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!state.current.isDown) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = x - state.current.startX;
    if (Math.abs(walk) > CLICK_THRESHOLD) {
      state.current.dragged = true;
    }
    el.scrollLeft = state.current.startScrollLeft - walk;
  }, []);

  const endDrag = useCallback(() => {
    state.current.isDown = false;
    const el = ref.current;
    if (el) el.style.cursor = 'grab';
  }, []);

  const onMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const onMouseLeave = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Prevent click after a drag: if we dragged, swallow the next click on children
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (state.current.dragged) {
      e.preventDefault();
      e.stopPropagation();
      state.current.dragged = false;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      state.current.isDown = false;
    };
  }, []);

  return {
    ref,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onClickCapture,
  };
}
