import * as React from 'react';
import {
  format,
  parse,
  getDaysInMonth,
  startOfMonth,
  getDay,
  setMonth,
  setYear,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface EventDatePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current value in yyyy-MM-dd format */
  value: string;
  /** Called with yyyy-MM-dd when user selects a date */
  onSelect: (date: string) => void;
  /** Min year for year list */
  fromYear?: number;
  /** Max year for year list */
  toYear?: number;
}

/**
 * Standard, mobile-friendly date picker modal.
 * Year dropdown + month navigation + day grid. Centered, no clipping, touch-friendly.
 */
export function EventDatePickerModal({
  open,
  onOpenChange,
  value,
  onSelect,
  fromYear = new Date().getFullYear() - 10,
  toYear = new Date().getFullYear() + 20,
}: EventDatePickerModalProps) {
  const initialDate = value
    ? (() => {
        try {
          return parse(value, 'yyyy-MM-dd', new Date());
        } catch {
          return new Date();
        }
      })()
    : new Date();

  const [viewDate, setViewDate] = React.useState(initialDate);

  // Keep view in sync when dialog opens or value changes
  React.useEffect(() => {
    if (open) {
      setViewDate(
        value
          ? (() => {
              try {
                return parse(value, 'yyyy-MM-dd', new Date());
              } catch {
                return new Date();
              }
            })()
          : new Date()
      );
    }
  }, [open, value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const selectedDate = value
    ? (() => {
        try {
          return parse(value, 'yyyy-MM-dd', new Date());
        } catch {
          return null;
        }
      })()
    : null;

  const firstOfMonth = startOfMonth(new Date(year, month));
  const daysInMonth = getDaysInMonth(firstOfMonth);
  const startWeekday = getDay(firstOfMonth); // 0 = Sunday

  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const [yearPopoverOpen, setYearPopoverOpen] = React.useState(false);
  const [monthPopoverOpen, setMonthPopoverOpen] = React.useState(false);

  const handlePrevMonth = () => setViewDate(subMonths(viewDate, 1));
  const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));
  const handleYearSelect = (y: number) => {
    setViewDate(setYear(viewDate, y));
    setYearPopoverOpen(false);
  };
  const handleMonthSelect = (m: number) => {
    setViewDate(setMonth(viewDate, m));
    setMonthPopoverOpen(false);
  };
  const handleDayClick = (day: number) => {
    const d = new Date(year, month, day);
    onSelect(format(d, 'yyyy-MM-dd'));
    onOpenChange(false);
  };

  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[100] max-w-[min(100vw-2rem,20rem)] p-0 gap-0 overflow-hidden rounded-xl">
        <div className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-lg font-semibold">Event Date</DialogTitle>
        </div>

        <div className="p-4 space-y-4">
          {/* Year & Month - popover lists stay within viewport, no native select clipping */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Year</span>
              <Popover open={yearPopoverOpen} onOpenChange={setYearPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full min-h-[44px] justify-between rounded-lg px-3 py-2 text-sm font-medium touch-manipulation"
                    aria-label="Select year"
                    aria-expanded={yearPopoverOpen}
                  >
                    {year}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[110] w-[var(--radix-popover-trigger-width)] min-w-0 p-0 rounded-lg border shadow-lg max-h-[min(60vh,320px)] overflow-y-auto overflow-x-hidden"
                  align="start"
                  sideOffset={6}
                  collisionPadding={12}
                  avoidCollisions
                >
                  <ul className="py-1" role="listbox" aria-label="Year list">
                    {years.map((y) => (
                      <li key={y} role="option" aria-selected={y === year}>
                        <button
                          type="button"
                          onClick={() => handleYearSelect(y)}
                          className={cn(
                            'w-full min-h-[44px] px-3 py-2.5 text-left text-sm touch-manipulation transition-colors',
                            y === year ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                          )}
                        >
                          {y}
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Month</span>
              <Popover open={monthPopoverOpen} onOpenChange={setMonthPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full min-h-[44px] justify-between rounded-lg px-3 py-2 text-sm font-medium touch-manipulation"
                    aria-label="Select month"
                    aria-expanded={monthPopoverOpen}
                  >
                    {MONTHS[month]}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[110] w-[var(--radix-popover-trigger-width)] min-w-0 p-0 rounded-lg border shadow-lg max-h-[min(60vh,320px)] overflow-y-auto overflow-x-hidden"
                  align="start"
                  sideOffset={6}
                  collisionPadding={12}
                  avoidCollisions
                >
                  <ul className="py-1" role="listbox" aria-label="Month list">
                    {MONTHS.map((name, i) => (
                      <li key={i} role="option" aria-selected={i === month}>
                        <button
                          type="button"
                          onClick={() => handleMonthSelect(i)}
                          className={cn(
                            'w-full min-h-[44px] px-3 py-2.5 text-left text-sm touch-manipulation transition-colors',
                            i === month ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                          )}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Month navigation - optional quick prev/next */}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              className="h-9 w-9 shrink-0 rounded-lg touch-manipulation"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-9 w-9 shrink-0 rounded-lg touch-manipulation"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day grid */}
          <div className="space-y-1">
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-[10px] font-medium text-muted-foreground py-1"
                >
                  {wd}
                </div>
              ))}
              {days.map((day, i) => {
                if (day === null) {
                  return <div key={`e-${i}`} className="aspect-square" />;
                }
                const cellDate = new Date(year, month, day);
                const isSelected =
                  selectedDate !== null && isSameDay(cellDate, selectedDate);
                const isCurrentMonth = isSameMonth(cellDate, firstOfMonth);
                return (
                  <button
                    key={`${year}-${month}-${day}`}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'aspect-square min-h-[40px] rounded-lg text-sm font-medium touch-manipulation transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                      isCurrentMonth
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground/60',
                      isSelected &&
                        'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                    aria-label={`Select ${format(cellDate, 'MMMM d, yyyy')}`}
                    aria-pressed={isSelected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
