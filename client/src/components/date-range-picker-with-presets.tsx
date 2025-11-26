import { useState } from "react";
import { DateRangePicker } from "react-date-range";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
  {
    label: "Today",
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
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
];

export default function DateRangePickerWithPresets({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: DateRangePickerWithPresetsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<any>([
    {
      startDate: fromDate ? new Date(fromDate) : new Date(),
      endDate: toDate ? new Date(toDate) : new Date(),
      key: "selection",
    },
  ]);

  const handleSelect = (ranges: any) => {
    const selection = ranges.selection;
    setState([selection]);

    if (selection.startDate) {
      const fromStr = selection.startDate.toISOString().split("T")[0];
      onFromDateChange?.(fromStr);
    }
    if (selection.endDate) {
      const toStr = selection.endDate.toISOString().split("T")[0];
      onToDateChange?.(toStr);
    }
  };

  const handlePresetClick = (preset: (typeof PRESET_RANGES)[0]) => {
    const { from, to } = preset.getValue();
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    setState([
      {
        startDate: from,
        endDate: to,
        key: "selection",
      },
    ]);

    onFromDateChange?.(fromStr);
    onToDateChange?.(toStr);
  };

  const handleClear = () => {
    onFromDateChange?.("");
    onToDateChange?.("");
    setState([
      {
        startDate: new Date(),
        endDate: new Date(),
        key: "selection",
      },
    ]);
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
          {/* Custom Sidebar with Presets */}
          <div className="w-40 border-r p-3 space-y-2 bg-muted/30">
            {PRESET_RANGES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted/60 transition-colors"
                data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {preset.label}
              </button>
            ))}
            {(fromDate || toDate) && (
              <>
                <div className="border-t my-2" />
                <button
                  onClick={handleClear}
                  className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors flex items-center gap-2"
                  data-testid="button-clear-dates"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Calendar */}
          <div className="p-4">
            <DateRangePicker
              ranges={state}
              onChange={handleSelect}
              months={2}
              direction="horizontal"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
