import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Client } from '@/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OPTIONAL_FIELDS: { key: keyof Client; question: string }[] = [
  { key: 'featuresYouLove', question: 'Which features do you love about yourself?' },
  { key: 'wardrobeColors', question: 'What specific colors make up the bulk of your wardrobe?' },
  { key: 'personalStyle', question: 'How would you describe your personal style?' },
  { key: 'dailySchedule', question: 'Briefly describe your daily schedule' },
  { key: 'featuresYouDislike', question: 'Are there any features you don\'t like as much?' },
  { key: 'styleIcons', question: 'Who are your style icons?' },
  { key: 'styleIconsDescription', question: 'Describe your style icons' },
  { key: 'additionalStyleInfo', question: 'Is there anything else you\'d like to share regarding your style?' },
  { key: 'instagramHandle', question: 'Instagram handle' },
  { key: 'outfitsPerDayEstimate', question: 'How many outfits do you wear in a given day?' },
  { key: 'weekdayOutfitDetails', question: 'Weekday outfits for work and/or home typically include' },
];

export function hasOptionalClientFields(client: Client | null): boolean {
  if (!client) return false;
  return OPTIONAL_FIELDS.some(
    ({ key }) => (client[key] as string | undefined)?.trim?.()
  );
}

function getOptionalSlides(client: Client | null): { question: string; answer: string }[] {
  if (!client) return [];
  return OPTIONAL_FIELDS.filter(
    ({ key }) => (client[key] as string | undefined)?.trim?.()
  ).map(({ key, question }) => ({
    question,
    answer: (client[key] as string)?.trim() ?? '',
  }));
}

interface ClientMoreInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export default function ClientMoreInfoSheet({
  open,
  onOpenChange,
  client,
}: ClientMoreInfoSheetProps) {
  const slides = getOptionalSlides(client);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api || !open) return;
    api.scrollTo(0);
    setCurrent(0);
  }, [api, open, client?.id]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => api.off('select', onSelect);
  }, [api]);

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);
  const canScrollPrev = current > 0;
  const canScrollNext = current < slides.length - 1 && slides.length > 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[80vw] max-w-3xl min-w-[260px] max-h-[60vh] min-h-[min(40vh,320px)] h-max overflow-y-auto flex-col border rounded-lg right-auto bottom-auto inset-x-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-xl p-6 gap-0"
      >
        <SheetHeader className="flex-shrink-0 text-center pb-4">
          <SheetTitle className="pr-8 break-words">
            {client?.name ? `${client.name}'s details` : 'More about client'}
          </SheetTitle>
        </SheetHeader>

        <div className="relative flex flex-col min-h-[200px]">
          {slides.length === 0 ? (
            <div className="flex flex-1 min-h-[200px] flex-col items-center justify-center rounded-lg border bg-white py-8 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                No additional details have been added for this client yet.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                You can add style preferences, schedule, and more in Edit Client.
              </p>
            </div>
          ) : (
          <>
          <Carousel
            key={client?.id ?? 'none'}
            opts={{ align: 'start', loop: false, skipSnaps: false }}
            setApi={setApi}
            viewportClassName="overflow-x-hidden overflow-y-visible"
            className="w-full"
          >
            <CarouselContent className="ml-0 flex">
              {slides.map((slide, index) => (
                <CarouselItem key={index} className="pl-0 basis-full flex-shrink-0">
                  <div className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border bg-white py-8 px-6 text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-3 w-full break-words">
                      {slide.question}
                    </p>
                    <p className="text-base text-foreground w-full max-w-full whitespace-pre-wrap break-words">
                      {slide.answer}
                    </p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {slides.length > 1 && (
            <div className="flex flex-shrink-0 items-center justify-center gap-2 pt-6 pb-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {current + 1} / {slides.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={scrollNext}
                disabled={!canScrollNext}
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
