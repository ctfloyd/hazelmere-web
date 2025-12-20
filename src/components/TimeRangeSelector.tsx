import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';

export interface TimeRange {
  startTime: Date;
  endTime: Date;
  label: string;
}

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

const PRESET_RANGES: TimeRange[] = [
  {
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endTime: new Date(),
    label: 'Last Week'
  },
  {
    startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endTime: new Date(),
    label: 'Last Month'
  },
  {
    startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endTime: new Date(),
    label: 'Last 3 Months'
  },
  {
    startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endTime: new Date(),
    label: 'Last Year'
  },
  {
    startTime: new Date('2021-10-01'),
    endTime: new Date(),
    label: 'All Time'
  }
];

export function TimeRangeSelector({ selectedRange, onRangeChange }: TimeRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: selectedRange.startTime,
    to: selectedRange.endTime
  });

  const handlePresetClick = (range: TimeRange) => {
    onRangeChange(range);
    setIsOpen(false);
    setShowCalendar(false);
  };

  const handleCustomClick = () => {
    setShowCalendar(true);
    setDateRange({
      from: selectedRange.startTime,
      to: selectedRange.endTime
    });
  };

  const handleApplyCustomRange = () => {
    if (dateRange?.from && dateRange?.to) {
      const customRange: TimeRange = {
        startTime: dateRange.from,
        endTime: dateRange.to,
        label: `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
      };
      onRangeChange(customRange);
      setIsOpen(false);
      setShowCalendar(false);
    }
  };

  const handleCancel = () => {
    setShowCalendar(false);
    setDateRange({
      from: selectedRange.startTime,
      to: selectedRange.endTime
    });
  };

  const isPresetSelected = PRESET_RANGES.some(r => r.label === selectedRange.label);

  return (
    <Card className="relative">
      <CardContent className="p-3">
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="truncate max-w-[200px]">{selectedRange.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>

        {isOpen && (
          <div className="absolute top-full left-0 z-10 mt-1 bg-background border border-border rounded-lg shadow-lg">
            {!showCalendar ? (
              <div className="p-2 space-y-1">
                {PRESET_RANGES.map((range, index) => (
                  <Button
                    key={index}
                    variant={selectedRange.label === range.label ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handlePresetClick(range)}
                    className="w-full justify-start"
                  >
                    {range.label}
                  </Button>
                ))}
                <div className="border-t border-border my-2" />
                <Button
                  variant={!isPresetSelected ? "default" : "ghost"}
                  size="sm"
                  onClick={handleCustomClick}
                  className="w-full justify-start"
                >
                  Custom Range...
                </Button>
              </div>
            ) : (
              <div className="p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Select Date Range</h4>
                  <p className="text-xs text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
                      : 'Click to select start and end dates'}
                  </p>
                </div>
                <style>{`
                  .rdp {
                    --rdp-cell-size: 36px;
                    --rdp-accent-color: hsl(var(--primary));
                    --rdp-background-color: hsl(var(--accent));
                    --rdp-accent-background-color: hsl(var(--accent));
                    --rdp-outline: 2px solid hsl(var(--primary));
                    --rdp-outline-selected: 2px solid hsl(var(--primary));
                    margin: 0;
                  }
                  .rdp-months {
                    display: flex;
                    gap: 1rem;
                  }
                  .rdp-month {
                    background: transparent;
                  }
                  .rdp-day_button {
                    border-radius: 0.375rem;
                  }
                  .rdp-selected .rdp-day_button {
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                  }
                  .rdp-range_middle .rdp-day_button {
                    background-color: hsl(var(--accent));
                    color: hsl(var(--accent-foreground));
                  }
                  .rdp-today .rdp-day_button {
                    font-weight: bold;
                  }
                  .rdp-disabled .rdp-day_button {
                    opacity: 0.5;
                  }
                `}</style>
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={{ before: new Date('2021-10-19'), after: new Date() }}
                />
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyCustomRange}
                    disabled={!dateRange?.from || !dateRange?.to}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
