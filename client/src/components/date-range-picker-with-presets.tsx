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
        <div style={{ display: "flex", flexDirection: "row" }}>
          <DateRangePicker
            ranges={state}
            onChange={handleSelect}
            months={2}
            direction="horizontal"
          />
          {(fromDate || toDate) && (
            <div
              style={{
                minWidth: "180px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "8px",
                borderLeft: "1px solid #e5e7eb",
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive justify-start"
                onClick={handleClear}
                data-testid="button-clear-dates"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
