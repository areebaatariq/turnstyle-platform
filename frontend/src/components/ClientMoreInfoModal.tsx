import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Client } from '@/types';

const SIZE_FIELDS: { key: keyof Client; label: string }[] = [
  { key: 'sizeTop', label: 'Top size' },
  { key: 'sizeBottom', label: 'Bottom size' },
  { key: 'sizeDress', label: 'Dress size' },
  { key: 'sizeShoes', label: 'Shoe size' },
  { key: 'braSize', label: 'Bra size' },
  { key: 'colorPreferences', label: 'Color preferences' },
];

const STYLE_FIELDS: { key: keyof Client; question: string }[] = [
  { key: 'featuresYouLove', question: 'Which features do you love about yourself?' },
  { key: 'wardrobeColors', question: 'What specific colors make up the bulk of your wardrobe?' },
  { key: 'personalStyle', question: 'How would you describe your personal style?' },
  { key: 'dailySchedule', question: 'Briefly describe your daily schedule' },
  { key: 'featuresYouDislike', question: "Are there any features you don't like as much?" },
  { key: 'styleIcons', question: 'Who are your style icons?' },
  { key: 'styleIconsDescription', question: 'Describe your style icons' },
  { key: 'additionalStyleInfo', question: "Is there anything else you'd like to share regarding your style?" },
  { key: 'instagramHandle', question: 'Instagram handle' },
  { key: 'outfitsPerDayEstimate', question: 'How many outfits do you wear in a given day?' },
  { key: 'weekdayOutfitDetails', question: 'Weekday outfits for work and/or home typically include' },
];

function getValue(client: Client | null, key: keyof Client): string {
  if (!client) return '—';
  const v = (client[key] as string | undefined)?.trim?.();
  return v ?? '—';
}

interface ClientMoreInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export default function ClientMoreInfoModal({
  open,
  onOpenChange,
  client,
}: ClientMoreInfoModalProps) {
  const hasStyleFields = client && STYLE_FIELDS.some(
    ({ key }) => (client[key] as string | undefined)?.trim?.()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[90vw] max-w-[90vw] sm:w-full sm:max-w-lg h-[520px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2 pr-10">
          <DialogTitle className="text-lg">
            {client?.name ? `${client.name}'s details` : 'Client details'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sizes" className="flex flex-col flex-1 min-h-[320px] overflow-hidden">
          <div className="flex-shrink-0 px-6 pt-2 pb-2">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="sizes" className="text-xs sm:text-sm">
                Sizes & colors
              </TabsTrigger>
              <TabsTrigger value="style" className="text-xs sm:text-sm">
                Style & more
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-[280px] overflow-hidden px-6 pb-6 flex flex-col">
            <TabsContent
              value="sizes"
              className="h-full min-h-0 overflow-y-auto mt-0 rounded-md data-[state=inactive]:hidden"
            >
              <div className="space-y-4 pt-2 pr-1">
                {SIZE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-muted-foreground font-normal text-sm">{label}</Label>
                    <p className="text-sm font-medium">{getValue(client, key)}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent
              value="style"
              className="h-full min-h-0 overflow-y-auto mt-0 rounded-md data-[state=inactive]:hidden"
            >
              <div className="pt-2 pr-1 h-full">
                {!hasStyleFields ? (
                  <div className="py-8 text-center rounded-lg border bg-white h-full flex flex-col items-center justify-center min-h-[200px]">
                    <p className="text-sm text-muted-foreground">
                      No additional style details have been added for this client yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      You can add these in Edit Client.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-2">
                    {STYLE_FIELDS.filter(
                      ({ key }) => (client?.[key] as string | undefined)?.trim?.()
                    ).map(({ key, question }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-muted-foreground font-normal text-sm">{question}</Label>
                        <p className="text-sm font-medium whitespace-pre-wrap break-words">
                          {(client?.[key] as string)?.trim() ?? ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
