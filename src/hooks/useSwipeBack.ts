import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * iOS-style swipe-back gesture.
 * - Touch starts within EDGE_PX from the left edge
 * - Horizontal swipe right exceeding THRESHOLD_PX (and dominant over vertical) triggers history back
 * - Ignores when starting on interactive scrollable elements that scroll horizontally
 */
const EDGE_PX = 28;
const THRESHOLD_PX = 70;
const MAX_VERTICAL_RATIO = 0.6; // |dy|/|dx| must be < this

export function useSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;

    const isInHorizontalScroller = (el: EventTarget | null): boolean => {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        if (node.scrollWidth > node.clientWidth) {
          const style = window.getComputedStyle(node);
          if (/(auto|scroll)/.test(style.overflowX)) return true;
        }
        // Skip if interacting with sliders, range inputs, draggable, carousels
        if (
          node.getAttribute?.('role') === 'slider' ||
          node.tagName === 'INPUT' && (node as HTMLInputElement).type === 'range' ||
          node.dataset?.swipeBackIgnore !== undefined
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      if (isInHorizontalScroller(e.target)) return;
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      tracking = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;
      if (dt > 700) return;
      if (dx < THRESHOLD_PX) return;
      if (Math.abs(dy) / Math.max(Math.abs(dx), 1) > MAX_VERTICAL_RATIO) return;

      // Only navigate back if there's history beyond root
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/admin-dashboard');
      }
    };

    const onTouchCancel = () => {
      tracking = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [navigate, location.pathname]);
}
