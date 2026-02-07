import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { ItemImageWithPreview } from '@/components/ItemImagePreview';
import { ClosetItem } from '@/types';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const CLOSET_DRAG_PREFIX = 'closet-';
const CANVAS_DRAG_PREFIX = 'canvas-';

/** Default grid positions (x%, y%) for outfit layout - ensures items don't overlap */
const DEFAULT_POSITIONS: [number, number][] = [
  [5, 5], [38, 5], [71, 5],
  [5, 38], [38, 38], [71, 38],
  [5, 71], [38, 71], [71, 71],
  [22, 22], [55, 22], [22, 55], [55, 55],
];

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;

export interface LookComposerItem {
  closetItem: ClosetItem;
  positionX: number;
  positionY: number;
  scale?: number;
}

interface LookComposerProps {
  closetItems: ClosetItem[];
  lookItems: LookComposerItem[];
  onLookItemsChange: (items: LookComposerItem[]) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  itemSize?: number;
  /** When true, only show the canvas (no closet panel). Use for multi-step Create Look flow. */
  canvasOnly?: boolean;
}

function ClosetDraggableItem({
  item,
  onAddToLook,
}: {
  item: ClosetItem;
  onAddToLook?: (item: ClosetItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${CLOSET_DRAG_PREFIX}${item.id}`,
    data: { type: 'closet', item },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'pan-y' }}
      className={`flex flex-col rounded-lg border bg-card cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors overflow-hidden min-w-0 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="aspect-square w-full bg-muted relative">
        <ItemImageWithPreview
          photoUrl={item.photoUrl}
          alt={item.name}
          caption={item.name}
          className="w-full h-full object-contain rounded-none bg-muted"
          draggable={false}
          previewActionLabel={onAddToLook ? 'Add Item' : undefined}
          onPreviewAction={onAddToLook ? () => onAddToLook(item) : undefined}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="56" height="56"%3E%3Crect fill="%23ddd" width="56" height="56"/%3E%3C/svg%3E';
          }}
        />
      </div>
      <span className="text-xs font-medium truncate px-2 py-1.5 text-center block min-w-0" title={item.name}>
        {item.name}
      </span>
    </div>
  );
}

interface CanvasItemProps {
  item: LookComposerItem;
  index: number;
  positions: Map<string, { x: number; y: number }>;
  scales: Map<string, number>;
  baseItemSize: number;
  onRemove: () => void;
  onScaleChange: (newScale: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  isMobile: boolean;
}

function CanvasDraggableItem({
  item,
  index,
  positions,
  scales,
  baseItemSize,
  onRemove,
  onScaleChange,
  containerRef,
  isMobile,
}: CanvasItemProps) {
  const id = `${CANVAS_DRAG_PREFIX}${item.closetItem.id}`;
  const pos = positions.get(id) ?? { x: item.positionX, y: item.positionY };
  const scale = scales.get(id) ?? item.scale ?? 1;
  
  // Calculate item size - use percentage-based sizing for consistency across devices
  const itemSizePercent = isMobile ? 28 : 22; // % of container width
  const scaledSizePercent = itemSizePercent * scale;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { type: 'canvas', item, pos },
  });

  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; startScale: number } | null>(null);

  // Handle resize via corner drag (desktop only)
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    if (isMobile) return; // Disable drag resize on mobile
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScale: scale,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [scale, isMobile]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (isMobile) return;
    if (!isResizing || !resizeStartRef.current || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - resizeStartRef.current.startX;
    const deltaY = e.clientY - resizeStartRef.current.startY;
    const delta = Math.max(deltaX, deltaY);
    const scaleDelta = (delta / (rect.width * 0.1));
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, resizeStartRef.current.startScale + scaleDelta));
    onScaleChange(newScale);
  }, [isResizing, containerRef, onScaleChange, isMobile]);

  const handleResizeEnd = useCallback((e: React.PointerEvent) => {
    if (isMobile) return;
    if (!isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(false);
    resizeStartRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, [isResizing, isMobile]);

  // Increment/decrement scale with buttons
  const handleScaleUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newScale = Math.min(MAX_SCALE, scale + SCALE_STEP);
    onScaleChange(newScale);
  }, [scale, onScaleChange]);

  const handleScaleDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newScale = Math.max(MIN_SCALE, scale - SCALE_STEP);
    onScaleChange(newScale);
  }, [scale, onScaleChange]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    // Only toggle controls on mobile, not on desktop
    if (isMobile) {
      e.stopPropagation();
      setShowControls(prev => !prev);
      setShowRemoveConfirm(false);
    }
  }, [isMobile]);

  const handleRemoveClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) {
      // On mobile, require confirmation
      if (showRemoveConfirm) {
        onRemove();
        setShowRemoveConfirm(false);
      } else {
        setShowRemoveConfirm(true);
        // Auto-hide confirmation after 3 seconds
        setTimeout(() => setShowRemoveConfirm(false), 3000);
      }
    } else {
      // On desktop, remove immediately
      onRemove();
    }
  }, [isMobile, showRemoveConfirm, onRemove]);

  // Hide controls when dragging starts
  useEffect(() => {
    if (isDragging) {
      setShowControls(false);
      setShowRemoveConfirm(false);
    }
  }, [isDragging]);

  // Close remove confirm when controls are hidden
  useEffect(() => {
    if (!showControls) {
      setShowRemoveConfirm(false);
    }
  }, [showControls]);

  // Clamp position to keep items visible within canvas
  const clampedX = Math.max(0, Math.min(pos.x, 100 - scaledSizePercent));
  const clampedY = Math.max(0, Math.min(pos.y, 100 - scaledSizePercent));

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${clampedX}%`,
    top: `${clampedY}%`,
    width: `${scaledSizePercent}%`,
    height: `${scaledSizePercent}%`,
    // Maintain aspect ratio
    aspectRatio: '1 / 1',
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging || showControls ? 50 : index + 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };

  const controlsVisible = isMobile ? showControls : true;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border-2 shadow-sm overflow-visible ${
        isDragging ? 'shadow-lg ring-2 ring-primary border-primary' : 'border-gray-200'
      } ${showControls && isMobile ? 'ring-2 ring-primary/50 border-primary' : ''}`}
      onClick={handleTap}
    >
      {/* Drag handle area - covers most of item, but not where controls are */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 z-10"
        style={{ touchAction: 'none' }}
      />

      {/* Item image */}
      <div className="w-full h-full rounded-lg overflow-hidden bg-white">
        <ItemImageWithPreview
          photoUrl={item.closetItem.photoUrl}
          alt={item.closetItem.name}
          caption={item.closetItem.name}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23ddd" width="80" height="80"/%3E%3C/svg%3E';
          }}
        />
      </div>

      {/* MOBILE: Top-center remove button (only shows when controls visible) */}
      {isMobile && (
        <div
          className={`absolute -top-2 left-1/2 -translate-x-1/2 transition-opacity z-20 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Button
            type="button"
            variant={showRemoveConfirm ? "destructive" : "secondary"}
            size="sm"
            className={`rounded-full shadow-lg pointer-events-auto transition-all ${
              showRemoveConfirm 
                ? 'h-8 w-8 bg-red-600 hover:bg-red-700 animate-pulse' 
                : 'h-7 w-7 bg-black/80 hover:bg-black text-white'
            }`}
            onClick={handleRemoveClick}
            aria-label={showRemoveConfirm ? "Confirm remove" : "Remove item"}
          >
            {showRemoveConfirm ? (
              <Trash2 className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* MOBILE: Resize controls - minus on left, plus on right */}
      {isMobile && (
        <>
          {/* Minus button on the left */}
          <div
            className={`absolute -left-3 top-1/2 -translate-y-1/2 transition-opacity z-20 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 w-6 rounded-full shadow pointer-events-auto bg-white p-0"
              onClick={handleScaleDown}
              disabled={scale <= MIN_SCALE}
              aria-label="Make smaller"
            >
              <Minus className="h-3 w-3" />
            </Button>
          </div>
          {/* Plus button on the right */}
          <div
            className={`absolute -right-3 top-1/2 -translate-y-1/2 transition-opacity z-20 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 w-6 rounded-full shadow pointer-events-auto bg-white p-0"
              onClick={handleScaleUp}
              disabled={scale >= MAX_SCALE}
              aria-label="Make larger"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}

      {/* DESKTOP: Top remove button */}
      {!isMobile && (
        <div
          className={`absolute -top-10 left-0 right-0 flex items-center justify-center gap-1 transition-opacity ${
            controlsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 w-8 rounded-full shadow-lg pointer-events-auto"
            onClick={handleRemoveClick}
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* DESKTOP: Resize handle - bottom right corner */}
      {!isMobile && (
        <div
          className={`absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full cursor-se-resize flex items-center justify-center shadow-md transition-opacity ${
            controlsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          style={{ touchAction: 'none' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="text-white"
          >
            <path
              d="M10 2L2 10M10 6L6 10M10 10L10 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

/** Generate a vertical white composite image with items (transparent bg when possible) */
export async function generateLookCompositeImage(
  items: LookComposerItem[],
  canvasWidth: number = 600,
  canvasHeight: number = 800,
  baseItemPixelSize: number = 180
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  let removeBackground: ((src: Blob | URL | string) => Promise<Blob>) | null = null;
  try {
    const mod = await import('@imgly/background-removal');
    removeBackground = typeof mod.removeBackground === 'function' ? mod.removeBackground : null;
  } catch {
    // Background removal not available, will use original images
  }

  const loadImage = (src: string | Blob): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = typeof src === 'string' ? src : URL.createObjectURL(src);
      if (typeof src === 'string' && !src.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (typeof src === 'object') URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        if (typeof src === 'object') URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });

  const getImageSrc = async (photoUrl: string): Promise<string | Blob> => {
    const fullUrl = toFullSizeImageUrl(photoUrl);
    if (removeBackground) {
      try {
        return await removeBackground(fullUrl);
      } catch {
        return fullUrl;
      }
    }
    return fullUrl;
  };

  for (const item of items) {
    try {
      const src = await getImageSrc(item.closetItem.photoUrl);
      const img = await loadImage(src);
      const x = (item.positionX / 100) * canvasWidth;
      const y = (item.positionY / 100) * canvasHeight;
      const itemScale = item.scale ?? 1;
      const scaledSize = baseItemPixelSize * itemScale;
      ctx.drawImage(img, x, y, scaledSize, scaledSize);
    } catch {
      // Skip items that fail to load (e.g. CORS)
    }
  }

  return canvas.toDataURL('image/png');
}

export default function LookComposer({
  closetItems,
  lookItems,
  onLookItemsChange,
  canvasWidth = 400,
  canvasHeight = 480,
  itemSize = 110,
  canvasOnly = false,
}: LookComposerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Build positions map from lookItems - always sync with lookItems as source of truth
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(() => new Map());
  const [scales, setScales] = useState<Map<string, number>>(() => new Map());

  // Sync positions and scales with lookItems whenever they change
  useEffect(() => {
    const newPositions = new Map<string, { x: number; y: number }>();
    const newScales = new Map<string, number>();
    
    lookItems.forEach((item, i) => {
      const id = `${CANVAS_DRAG_PREFIX}${item.closetItem.id}`;
      const [dx, dy] = DEFAULT_POSITIONS[i % DEFAULT_POSITIONS.length];
      
      // Use item's position if set, otherwise use default
      newPositions.set(id, {
        x: item.positionX ?? dx,
        y: item.positionY ?? dy,
      });
      newScales.set(id, item.scale ?? 1);
    });
    
    setPositions(newPositions);
    setScales(newScales);
  }, [lookItems]);

  const { setNodeRef: setCanvasRef, isOver: isOverCanvas } = useDroppable({
    id: 'look-canvas',
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const lastOverRef = useRef<{ id: string | number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 10 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    lastOverRef.current = null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) lastOverRef.current = event.over;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over, delta } = event;
    const effectiveOver = over ?? lastOverRef.current;
    const activeId = String(active.id);
    const isOverLookArea =
      effectiveOver?.id === 'look-canvas' ||
      String(effectiveOver?.id ?? '').startsWith(CANVAS_DRAG_PREFIX);
    // When dragging from closet with no collision detected, still accept (canvas is the only drop target)
    const addFromCloset = activeId.startsWith(CLOSET_DRAG_PREFIX);
    const shouldAddToCanvas = addFromCloset && (isOverLookArea || !effectiveOver);

    if (shouldAddToCanvas) {
      const itemId = activeId.replace(CLOSET_DRAG_PREFIX, '');
      const closetItem = closetItems.find((c) => c.id === itemId);
      if (closetItem && !lookItems.some((li) => li.closetItem.id === itemId)) {
        const [dx, dy] = DEFAULT_POSITIONS[lookItems.length % DEFAULT_POSITIONS.length];
        const newItem: LookComposerItem = {
          closetItem,
          positionX: dx,
          positionY: dy,
          scale: 1,
        };
        // Let the useEffect sync handle position/scale updates
        onLookItemsChange([...lookItems, newItem]);
      }
      return;
    }

    // Reposition canvas item — always apply when dragging a canvas item (no need for effectiveOver)
    if (activeId.startsWith(CANVAS_DRAG_PREFIX) && containerRef.current && (delta.x !== 0 || delta.y !== 0)) {
      const itemId = activeId.replace(CANVAS_DRAG_PREFIX, '');
      const item = lookItems.find((li) => li.closetItem.id === itemId);
      if (item) {
        const rect = containerRef.current.getBoundingClientRect();
        const currentPos = positions.get(activeId) ?? { x: item.positionX, y: item.positionY };
        const deltaXPercent = (delta.x / rect.width) * 100;
        const deltaYPercent = (delta.y / rect.height) * 100;
        
        // Calculate item size in percentage (same as in CanvasDraggableItem)
        const itemSizePercent = isMobile ? 28 : 22;
        const scale = scales.get(activeId) ?? item.scale ?? 1;
        const scaledSizePercent = itemSizePercent * scale;
        
        // Clamp to keep item within bounds
        const maxPosX = Math.max(0, 100 - scaledSizePercent);
        const maxPosY = Math.max(0, 100 - scaledSizePercent);
        const newX = Math.max(0, Math.min(maxPosX, currentPos.x + deltaXPercent));
        const newY = Math.max(0, Math.min(maxPosY, currentPos.y + deltaYPercent));

        // Round to 1 decimal place for cleaner values
        const roundedX = Math.round(newX * 10) / 10;
        const roundedY = Math.round(newY * 10) / 10;

        setPositions((prev) => {
          const next = new Map(prev);
          next.set(activeId, { x: roundedX, y: roundedY });
          return next;
        });
        onLookItemsChange(
          lookItems.map((li) =>
            li.closetItem.id === itemId
              ? { ...li, positionX: roundedX, positionY: roundedY }
              : li
          )
        );
      }
    }
  };

  const handleRemoveItem = (closetItemId: string) => {
    // Let the useEffect sync handle position/scale cleanup
    onLookItemsChange(lookItems.filter((li) => li.closetItem.id !== closetItemId));
  };

  const handleScaleChange = useCallback(
    (closetItemId: string, newScale: number) => {
      const id = `${CANVAS_DRAG_PREFIX}${closetItemId}`;
      setScales((prev) => {
        const next = new Map(prev);
        next.set(id, newScale);
        return next;
      });
      onLookItemsChange(
        lookItems.map((li) =>
          li.closetItem.id === closetItemId
            ? { ...li, scale: newScale }
            : li
        )
      );
    },
    [lookItems, onLookItemsChange]
  );

  const handleAddItemToLook = useCallback(
    (closetItem: ClosetItem) => {
      if (lookItems.some((li) => li.closetItem.id === closetItem.id)) return;
      const [dx, dy] = DEFAULT_POSITIONS[lookItems.length % DEFAULT_POSITIONS.length];
      const newItem: LookComposerItem = {
        closetItem,
        positionX: dx,
        positionY: dy,
        scale: 1,
      };
      // Let the useEffect sync handle position/scale updates
      onLookItemsChange([...lookItems, newItem]);
    },
    [lookItems, onLookItemsChange]
  );

  const itemsInLookIds = new Set(lookItems.map((li) => li.closetItem.id));
  const availableClosetItems = closetItems.filter((c) => !itemsInLookIds.has(c.id));

  const activeClosetItem =
    activeId?.startsWith(CLOSET_DRAG_PREFIX) &&
    closetItems.find((c) => `${CLOSET_DRAG_PREFIX}${c.id}` === activeId);
  const activeCanvasItem =
    activeId?.startsWith(CANVAS_DRAG_PREFIX) &&
    lookItems.find((li) => `${CANVAS_DRAG_PREFIX}${li.closetItem.id}` === activeId);

  const collisionDetection = useCallback(
    (args: Parameters<typeof pointerWithin>[0]) => {
      const pointerResults = pointerWithin(args);
      if (pointerResults.length > 0) return pointerResults;
      return rectIntersection(args);
    },
    []
  );

  // Dynamic canvas height based on content - minimum height for empty state
  const effectiveCanvasHeight = Math.max(
    canvasHeight,
    lookItems.length === 0 ? 200 : canvasHeight
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 flex-col lg:flex-row">
        {!canvasOnly && (
        <div
          className={`w-full lg:min-w-0 transition-all duration-200 ${
            lookItems.length > 0 ? 'lg:w-72 lg:flex-shrink-0' : 'lg:w-1/2 lg:flex-shrink-0'
          }`}
        >
          <p className="text-sm font-medium mb-2">Closet</p>
          <p className="text-xs text-muted-foreground mb-2">
            Drag items into the look area
          </p>
          <div
            className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain p-2 border rounded-lg bg-white touch-pan-y [-webkit-overflow-scrolling:touch]"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            {availableClosetItems.length === 0 ? (
              <p className="col-span-2 text-xs text-muted-foreground py-4 text-center">
                {closetItems.length === 0
                  ? 'Closet is empty'
                  : 'All items are in the look'}
              </p>
            ) : (
              availableClosetItems.map((item) => (
                <ClosetDraggableItem
                  key={item.id}
                  item={item}
                  onAddToLook={handleAddItemToLook}
                />
              ))
            )}
          </div>
        </div>
        )}

        <div
          className={`w-full lg:min-w-0 transition-all duration-200 ${
            canvasOnly ? 'flex-1' : lookItems.length > 0 ? 'lg:flex-1 lg:min-w-0' : 'lg:w-1/2 lg:flex-shrink-0'
          }`}
        >
          {!canvasOnly && (
            <>
              <p className="text-sm font-medium mb-2">Look</p>
              {lookItems.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  {isMobile 
                    ? 'Tap item to show controls • Drag to move' 
                    : 'Drag items to reposition • Drag corner to resize'}
                </p>
              )}
            </>
          )}
          {canvasOnly && lookItems.length > 0 && !isMobile && (
            <p className="text-xs text-muted-foreground mb-3">
              Drag items to reposition • Drag corner to resize
            </p>
          )}
          <div
            ref={(node) => {
              (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              setCanvasRef(node as HTMLElement);
            }}
            className={`relative w-full rounded-xl border-2 border-dashed transition-colors ${
              isOverCanvas ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-white'
            }`}
            style={{
              height: effectiveCanvasHeight,
              minHeight: effectiveCanvasHeight,
              // Allow items to overflow slightly for controls, but clip excessive overflow
              overflow: 'visible',
              // Prevent touch scroll on canvas
              touchAction: 'none',
              // Stable position
              position: 'relative',
            }}
          >
            {lookItems.length === 0 ? (
              <div className="flex items-center justify-center min-h-[200px] py-8 px-4">
                <p className="text-sm text-muted-foreground text-center">
                  {canvasOnly 
                    ? 'Your selected items will appear here' 
                    : 'Drop items here to compose your look'}
                </p>
              </div>
            ) : (
              /* Canvas items container - no transform scaling, items positioned absolutely */
              lookItems.map((item, index) => {
                const id = `${CANVAS_DRAG_PREFIX}${item.closetItem.id}`;
                return (
                  <CanvasDraggableItem
                    key={item.closetItem.id}
                    item={{
                      ...item,
                      positionX: positions.get(id)?.x ?? item.positionX,
                      positionY: positions.get(id)?.y ?? item.positionY,
                      scale: scales.get(id) ?? item.scale ?? 1,
                    }}
                    index={index}
                    positions={positions}
                    scales={scales}
                    baseItemSize={itemSize}
                    onRemove={() => handleRemoveItem(item.closetItem.id)}
                    onScaleChange={(newScale) => handleScaleChange(item.closetItem.id, newScale)}
                    containerRef={containerRef}
                    isMobile={isMobile}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay dropAnimation={null} style={{ touchAction: 'none' }}>
            {activeClosetItem ? (
              <div className="flex flex-col rounded-lg border bg-card shadow-lg cursor-grabbing overflow-hidden w-24 sm:w-28">
                <div className="aspect-square w-full bg-muted">
                  <img
                    src={toFullSizeImageUrl(activeClosetItem.photoUrl)}
                    alt={activeClosetItem.name}
                    className="w-full h-full object-contain bg-muted"
                    draggable={false}
                  />
                </div>
                <span className="text-xs font-medium truncate px-2 py-1 text-center block min-w-0">{activeClosetItem.name}</span>
              </div>
            ) : activeCanvasItem ? (
              /* Use fixed pixel size for overlay to match visual appearance */
              <div
                className="rounded-lg border-2 border-primary shadow-xl overflow-hidden bg-white"
                style={{ 
                  width: isMobile ? 100 : 90, 
                  height: isMobile ? 100 : 90,
                }}
              >
                <img
                  src={toFullSizeImageUrl(activeCanvasItem.closetItem.photoUrl)}
                  alt={activeCanvasItem.closetItem.name}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
