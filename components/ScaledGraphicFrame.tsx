"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScaledGraphicFrameProps {
  children: React.ReactNode;
  designWidth?: number;
  onScaleChange?: (scale: number) => void;
}

export function ScaledGraphicFrame({
  children,
  designWidth = 1060,
  onScaleChange,
}: ScaledGraphicFrameProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      setContainerWidth(outer.clientWidth);
      setNaturalHeight(inner.offsetHeight);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);

    return () => ro.disconnect();
  }, []);

  const scale =
    containerWidth > 0 && containerWidth < designWidth
      ? containerWidth / designWidth
      : 1;

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  return (
    <div
      ref={outerRef}
      className="w-full overflow-hidden pb-1"
      style={
        scale < 1 && naturalHeight > 0
          ? { height: `${Math.ceil(naturalHeight * scale) + 4}px` }
          : undefined
      }
    >
      <div
        ref={innerRef}
        style={
          scale < 1
            ? {
                width: designWidth,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
