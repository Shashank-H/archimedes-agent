import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

type CustomHorizontalScrollbarProps = {
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  viewportProps?: HTMLAttributes<HTMLDivElement>;
  children: ReactNode;
};

type ScrollbarMetrics = {
  hasOverflow: boolean;
  thumbLeft: number;
  thumbWidth: number;
};

const MIN_THUMB_WIDTH = 28;
const DEFAULT_SCROLLBAR_METRICS: ScrollbarMetrics = {
  hasOverflow: false,
  thumbLeft: 0,
  thumbWidth: 0,
};

export function CustomHorizontalScrollbar({
  className,
  viewportClassName,
  contentClassName,
  viewportProps,
  children,
}: CustomHorizontalScrollbarProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerStartX: number; scrollStartLeft: number } | null>(null);
  const [metrics, setMetrics] = useState<ScrollbarMetrics>(DEFAULT_SCROLLBAR_METRICS);

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    if (maxScrollLeft <= 1) {
      setMetrics((currentMetrics) => currentMetrics.hasOverflow ? DEFAULT_SCROLLBAR_METRICS : currentMetrics);
      return;
    }

    const trackWidth = track.clientWidth;
    const thumbWidth = Math.max(MIN_THUMB_WIDTH, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = (viewport.scrollLeft / maxScrollLeft) * maxThumbLeft;

    setMetrics((currentMetrics) => {
      const nextMetrics = { hasOverflow: true, thumbLeft, thumbWidth };
      const metricsMatch =
        currentMetrics.hasOverflow === nextMetrics.hasOverflow &&
        Math.abs(currentMetrics.thumbLeft - nextMetrics.thumbLeft) < 0.5 &&
        Math.abs(currentMetrics.thumbWidth - nextMetrics.thumbWidth) < 0.5;

      return metricsMatch ? currentMetrics : nextMetrics;
    });
  }, []);

  useLayoutEffect(() => {
    updateMetrics();

    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return undefined;

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(viewport);
    resizeObserver.observe(track);
    if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);

    return () => resizeObserver.disconnect();
  }, [children, updateMetrics]);

  const handleViewportScroll = useCallback(() => updateMetrics(), [updateMetrics]);

  const scrollToPointerPosition = useCallback((clientX: number) => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || !metrics.hasOverflow) return;

    const trackRect = track.getBoundingClientRect();
    const pointerX = clientX - trackRect.left;
    const centeredThumbLeft = pointerX - metrics.thumbWidth / 2;
    const maxThumbLeft = Math.max(1, track.clientWidth - metrics.thumbWidth);
    const scrollRatio = Math.min(1, Math.max(0, centeredThumbLeft / maxThumbLeft));

    viewport.scrollLeft = scrollRatio * (viewport.scrollWidth - viewport.clientWidth);
  }, [metrics.hasOverflow, metrics.thumbWidth]);

  const handleTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    scrollToPointerPosition(event.clientX);
  }, [scrollToPointerPosition]);

  const handleThumbPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerStartX: event.clientX,
      scrollStartLeft: viewport.scrollLeft,
    };
  }, []);

  const handleThumbPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !track || !dragState) return;

    const scrollableWidth = viewport.scrollWidth - viewport.clientWidth;
    const draggableWidth = Math.max(1, track.clientWidth - metrics.thumbWidth);
    const scrollPerPixel = scrollableWidth / draggableWidth;

    viewport.scrollLeft = dragState.scrollStartLeft + (event.clientX - dragState.pointerStartX) * scrollPerPixel;
  }, [metrics.thumbWidth]);

  const handleThumbPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const viewport = (
    <div
      {...viewportProps}
      ref={viewportRef}
      className={viewportClassName}
      onScroll={(event) => {
        viewportProps?.onScroll?.(event);
        handleViewportScroll();
      }}
    >
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </div>
  );

  return (
    <div className={className} data-overflow={metrics.hasOverflow ? 'true' : 'false'}>
      {viewport}
      <div
        ref={trackRef}
        className="custom-horizontal-scrollbar"
        aria-hidden={!metrics.hasOverflow}
        onPointerDown={handleTrackPointerDown}
      >
        <div
          className="custom-horizontal-scrollbar-thumb"
          role="presentation"
          aria-hidden="true"
          style={{
            width: metrics.thumbWidth,
            transform: `translateX(${metrics.thumbLeft}px)`,
          }}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
        />
      </div>
    </div>
  );
}
