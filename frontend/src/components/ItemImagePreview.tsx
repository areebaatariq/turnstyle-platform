import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { cn } from '@/lib/utils';

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  caption?: string;
  /** Optional primary action button (e.g. "Add Item"). When clicked, onAction is called and the dialog closes. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Full-screen style image preview dialog. Mobile-friendly: tap overlay or close button to close.
 * Optionally shows an action button (e.g. "Add Item") that runs onAction and closes the dialog.
 */
export function ImagePreviewDialog({
  open,
  onOpenChange,
  src,
  alt,
  caption,
  actionLabel,
  onAction,
}: ImagePreviewDialogProps) {
  const fullSrc = src ? toFullSizeImageUrl(src) : src;

  const handleAction = () => {
    onAction?.();
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={() => onOpenChange(false)}
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-[min(100vw,90vw)] max-w-4xl translate-x-[-50%] translate-y-[-50%] p-4 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onPointerDownOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="flex flex-col items-center gap-3">
            <img
              src={fullSrc}
              alt={alt}
              className="max-h-[85vh] w-auto max-w-full object-contain rounded"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
            {caption && (
              <p className="text-sm text-white/90 text-center max-w-full truncate px-2">
                {caption}
              </p>
            )}
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
                className="mt-1 min-h-[44px] px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-base shadow-lg hover:bg-primary/90 active:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-transparent touch-manipulation"
                aria-label={actionLabel}
              >
                {actionLabel}
              </button>
            )}
          </div>
          <DialogPrimitive.Close
            className="absolute right-2 top-2 rounded-full p-2 bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ItemImageWithPreviewProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Item photo URL (data URL, blob, or remote URL). Passed through toFullSizeImageUrl for display. */
  photoUrl: string;
  /** Optional caption shown in the preview dialog. */
  caption?: string;
  /** Optional label for action button in the expanded preview (e.g. "Add Item"). */
  previewActionLabel?: string;
  /** Called when the user taps the action button in the expanded preview. Dialog closes after. */
  onPreviewAction?: () => void;
}

/**
 * Renders an image that opens a full-size preview on click. Use anywhere closet/item images are shown.
 * Call e.stopPropagation() when using inside a clickable parent (e.g. card or button) so the preview opens without triggering the parent action.
 * Optionally show an action button in the preview (e.g. "Add Item") via previewActionLabel and onPreviewAction.
 */
export function ItemImageWithPreview({
  photoUrl,
  alt,
  caption,
  className,
  onClick,
  previewActionLabel,
  onPreviewAction,
  ...imgProps
}: ItemImageWithPreviewProps) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const fullUrl = photoUrl ? toFullSizeImageUrl(photoUrl) : photoUrl;

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    setPreviewOpen(true);
    onClick?.(e);
  };

  return (
    <>
      <img
        src={fullUrl}
        alt={alt}
        className={cn('cursor-pointer', className)}
        onClick={handleClick}
        {...imgProps}
      />
      <ImagePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        src={photoUrl}
        alt={alt}
        caption={caption}
        actionLabel={previewActionLabel}
        onAction={onPreviewAction}
      />
    </>
  );
}
