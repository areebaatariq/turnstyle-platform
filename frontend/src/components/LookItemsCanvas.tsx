import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { ClosetItem, LookItem } from '@/types';
import { GripVertical } from 'lucide-react';

/** Default scattered positions (x%, y%) for organic layout - cycles for many items */
const DEFAULT_POSITIONS: [number, number][] = [
  [5, 3], [42, 5], [75, 8],   // top row
  [3, 35], [45, 32], [82, 38], // middle row
  [10, 62], [48, 58], [78, 65], // bottom row
  [25, 20], [60, 18], [15, 48], [70, 52], // extra slots
];

export interface CanvasItem {
  closetItem: ClosetItem;
  lookItem?: LookItem;
}

interface LookItemsCanvasProps {
  items: CanvasItem[];
  editable?: boolean;
  onPositionChange?: (lookItemId: string, positionX: number, positionY: number) => void;
  itemSize?: number;
  minHeight?: number;
  /** When true, canvas height fits content exactly (no extra space below). For view-only. */
  fitContent?: boolean;
  /** 'scattered' = absolute positions, 'horizontal' = single row with horizontal scroll (view-only) */
  layout?: 'scattered' | 'horizontal';
  /** When true, use percentage-based sizing for consistency with LookComposer */
  usePercentageSizing?: boolean;
}

function getItemPosition(item: CanvasItem, index: number): { x: number; y: number } {
  const [defaultX, defaultY] = DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
  const pos = item.lookItem?.positionX != null && item.lookItem?.positionY != null
    ? { x: item.lookItem.positionX, y: item.lookItem.positionY }
    : { x: defaultX, y: defaultY };
  return pos;
}

function DraggableCanvasItem({
  item,
  index,
  positions,
  editable,
  itemSize,
  usePercentageSizing = false,
}: {
  item: CanvasItem;
  index: number;
  positions: Map<string, { x: number; y: number }>;
  editable: boolean;
  itemSize: number;
  usePercentageSizing?: boolean;
}) {
  const id = item.lookItem?.id ?? item.closetItem.id;
  const pos = positions.get(id) ?? getItemPosition(item, index);
  // Apply scale from lookItem if available
  const scale = item.lookItem?.scale ?? 1;
  
  // Use percentage-based sizing for consistency with LookComposer
  const baseSizePercent = 22; // % of container width
  const scaledSizePercent = baseSizePercent * scale;
  const scaledSizePixels = itemSize * scale;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { item, pos },
  });

  // Clamp position to keep items visible
  const maxPos = usePercentageSizing ? Math.max(0, 100 - scaledSizePercent) : 70;
  const clampedX = Math.max(0, Math.min(pos.x, maxPos));
  const clampedY = Math.max(0, Math.min(pos.y, maxPos));

  const style: React.CSSProperties = usePercentageSizing ? {
    position: 'absolute',
    left: `${clampedX}%`,
    top: `${clampedY}%`,
    width: `${scaledSizePercent}%`,
    height: `${scaledSizePercent}%`,
    aspectRatio: '1 / 1',
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : index + 1,
    cursor: editable ? 'grab' : 'default',
    touchAction: editable ? 'none' : 'auto',
  } : {
    position: 'absolute',
    left: `${clampedX}%`,
    top: `${clampedY}%`,
    width: scaledSizePixels,
    height: scaledSizePixels,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : index + 1,
    cursor: editable ? 'grab' : 'default',
    touchAction: editable ? 'none' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border-2 border-gray-200 shadow-md overflow-hidden transition-shadow ${
        editable ? 'hover:shadow-lg hover:border-primary/30' : ''
      } ${isDragging ? 'shadow-xl ring-2 ring-primary' : ''}`}
    >
      <div className="relative w-full h-full">
        {editable && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-1 left-1 z-10 p-1 rounded bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <img
          src={toFullSizeImageUrl(item.closetItem.photoUrl)}
          alt={item.closetItem.name}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect fill="%23ddd" width="120" height="120"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
          <p className="text-white text-xs font-medium truncate drop-shadow">{item.closetItem.name}</p>
        </div>
      </div>
    </div>
  );
}

/** Compute min height so canvas ends exactly at bottom of lowest item (no extra space) */
function computeFitHeight(positions: Map<string, { x: number; y: number }>, itemSize: number, padding = 4): number {
  let maxY = 0;
  positions.forEach((pos) => {
    maxY = Math.max(maxY, Math.min(pos.y, 99));
  });
  if (maxY >= 99) maxY = 98;
  return Math.ceil(itemSize / (1 - maxY / 100)) + padding;
}

function HorizontalItemCard({
  item,
  itemSize,
}: {
  item: CanvasItem;
  itemSize: number;
}) {
  // Apply scale from lookItem if available
  const scale = item.lookItem?.scale ?? 1;
  const scaledSize = itemSize * scale;

  return (
    <div
      className="flex-shrink-0 rounded-lg border-2 border-gray-200 shadow-md overflow-hidden"
      style={{ width: scaledSize, height: scaledSize }}
    >
      <div className="relative w-full h-full">
        <img
          src={toFullSizeImageUrl(item.closetItem.photoUrl)}
          alt={item.closetItem.name}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect fill="%23ddd" width="120" height="120"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
          <p className="text-white text-xs font-medium truncate drop-shadow">{item.closetItem.name}</p>
        </div>
      </div>
    </div>
  );
}

export default function LookItemsCanvas({
  items,
  editable = false,
  onPositionChange,
  itemSize = 120,
  minHeight = 380,
  fitContent = false,
  layout = 'scattered',
  usePercentageSizing = false,
}: LookItemsCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    items.forEach((item, i) => {
      const id = item.lookItem?.id ?? item.closetItem.id;
      map.set(id, getItemPosition(item, i));
    });
    return map;
  }, [items]);

  const [positionsState, setPositionsState] = useState(positions);
  // Sync when items change (e.g. new items added)
  useEffect(() => {
    setPositionsState(positions);
  }, [positions]);

  const { setNodeRef } = useDroppable({ id: 'look-canvas' });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (!containerRef.current || !onPositionChange || (delta.x === 0 && delta.y === 0)) return;

    const itemId = String(active.id);
    const item = items.find((i) => (i.lookItem?.id ?? i.closetItem.id) === itemId);
    if (!item) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentPos = positionsState.get(itemId) ?? getItemPosition(item, 0);
    const deltaXPercent = (delta.x / rect.width) * 100;
    const deltaYPercent = (delta.y / rect.height) * 100;
    
    // Calculate max position based on sizing mode
    const scale = item.lookItem?.scale ?? 1;
    let maxPos: number;
    if (usePercentageSizing) {
      const baseSizePercent = 22;
      const scaledSizePercent = baseSizePercent * scale;
      maxPos = Math.max(0, 100 - scaledSizePercent);
    } else {
      const itemSizePercent = (itemSize * scale / Math.min(rect.width, rect.height)) * 100;
      maxPos = 100 - Math.min(itemSizePercent, 30);
    }
    
    const newX = Math.max(0, Math.min(maxPos, currentPos.x + deltaXPercent));
    const newY = Math.max(0, Math.min(maxPos, currentPos.y + deltaYPercent));

    setPositionsState((prev) => {
      const next = new Map(prev);
      next.set(itemId, { x: newX, y: newY });
      return next;
    });
    onPositionChange(itemId, Math.round(newX * 10) / 10, Math.round(newY * 10) / 10);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[320px] rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center bg-white">
        <p className="text-sm text-muted-foreground">No items in this look</p>
      </div>
    );
  }

  // Horizontal scroll layout (view-only)
  if (layout === 'horizontal') {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="flex gap-4 p-4 overflow-x-auto overflow-y-hidden scroll-smooth" style={{ minHeight: itemSize + 32 }}>
          {items.map((item) => (
            <HorizontalItemCard
              key={item.lookItem?.id ?? item.closetItem.id}
              item={item}
              itemSize={itemSize}
            />
          ))}
        </div>
      </div>
    );
  }

  const effectiveHeight = fitContent ? computeFitHeight(positionsState, itemSize) : minHeight;

  const canvasContent = (
    <div
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        setNodeRef(node as HTMLElement);
      }}
      className="relative w-full rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ minHeight: effectiveHeight, height: fitContent ? effectiveHeight : undefined }}
    >
      {items.map((item, index) => (
        <DraggableCanvasItem
          key={item.lookItem?.id ?? item.closetItem.id}
          item={item}
          index={index}
          positions={positionsState}
          editable={editable}
          itemSize={itemSize}
          usePercentageSizing={usePercentageSizing}
        />
      ))}
    </div>
  );

  if (editable && onPositionChange) {
    return (
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {canvasContent}
        {editable && (
          <p className="text-xs text-muted-foreground mt-2">
            Drag items to arrange them on the look
          </p>
        )}
      </DndContext>
    );
  }

  return canvasContent;
}
