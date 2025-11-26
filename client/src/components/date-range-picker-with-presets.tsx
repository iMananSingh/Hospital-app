import { useState } from "react";
import { DateRange, DateRangePicker } from "react-date-range";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, X } from "lucide-react";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

interface DateRangePickerWithPresetsProps {
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (date: string) => void;
  onToDateChange?: (date: string) => void;
  onTodayClick?: () => void;
}

const PRESET_RANGES = [
  { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
  {
    label: "Yesterday",
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    label: "This Week",
    getValue: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { from: start, to: now };
    },
  },
  {
    label: "Last Week",
    getValue: () => {
      const now = new Date();
      const end = new Date(now);
      end.setDate(now.getDate() - now.getDay() - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { from: start, to: end };
    },
  },
  {
    label: "This Month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start, to: now };
    },
  },
  {
    label: "Last Month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start, to: end };
    },
  },
  {
    label: "Last 3 Months",
    getValue: () => {
      const now = new Date();
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return { from: start, to: now };
    },
  },
];

export default function DateRangePickerWithPresets({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onTodayClick,
}: DateRangePickerWithPresetsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: fromDate ? new Date(fromDate) : new Date(),
    endDate: toDate ? new Date(toDate) : new Date(),
    key: "selection",
  });

  const handleRangeChange = (ranges: { selection: DateRange }) => {
    const { startDate, endDate } = ranges.selection;
    setDateRange(ranges.selection);

    if (startDate) {
      const fromStr = startDate.toISOString().split("T")[0];
      onFromDateChange?.(fromStr);
    }
    if (endDate) {
      const toStr = endDate.toISOString().split("T")[0];
      onToDateChange?.(toStr);
    }
  };

  const handlePresetClick = (preset: (typeof PRESET_RANGES)[0]) => {
    const { from, to } = preset.getValue();
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    setDateRange({
      startDate: from,
      endDate: to,
      key: "selection",
    });

    onFromDateChange?.(fromStr);
    onToDateChange?.(toStr);
  };

  const handleClear = () => {
    onFromDateChange?.("");
    onToDateChange?.("");
    setDateRange({
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 px-4 py-2 h-auto"
          data-testid="button-date-range-picker"
        >
          <CalendarDays className="w-4 h-4" />
          <span className="text-sm">
            {fromDate && toDate ? `${fromDate} to ${toDate}` : "Select dates"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets Sidebar */}
          <div className="w-48 border-r p-4 space-y-2 bg-muted/30">
            <div className="text-sm font-semibold text-muted-foreground mb-4">
              Quick Options
            </div>
            {PRESET_RANGES.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => handlePresetClick(preset)}
                data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {preset.label}
              </Button>
            ))}
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                className="w-full justify-start text-sm text-destructive hover:text-destructive"
                onClick={handleClear}
                data-testid="button-clear-dates"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Calendar */}
          <div className="p-4">
            <DateRangePicker
              ranges={[dateRange]}
              onChange={handleRangeChange}
              months={2}
              direction="horizontal"
              data-testid="date-range-picker"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
