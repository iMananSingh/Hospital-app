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

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onFromDateChange?.(value);
    if (value) {
      const date = new Date(value);
      setState([
        {
          ...state[0],
          startDate: date,
        },
      ]);
    }
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onToDateChange?.(value);
    if (value) {
      const date = new Date(value);
      setState([
        {
          ...state[0],
          endDate: date,
        },
      ]);
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
        <div className="flex items-center gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent/50 cursor-pointer transition-colors" data-testid="button-date-range-picker">
          <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="date"
            value={fromDate || ""}
            onChange={handleFromDateChange}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-sm outline-none w-[120px] cursor-text"
            data-testid="input-from-date"
          />
          <span className="text-sm text-muted-foreground font-medium">To</span>
          <input
            type="date"
            value={toDate || ""}
            onChange={handleToDateChange}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-sm outline-none w-[120px] cursor-text"
            data-testid="input-to-date"
          />
          {(fromDate || toDate) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="ml-auto text-destructive hover:text-destructive/80 transition-colors flex-shrink-0"
              data-testid="button-clear-dates"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <style>{`
          .rdrDateRangePickerWrapper.with-clear-button {
            position: relative;
          }
          .rdrDateRangePickerWrapper.with-clear-button .rdrSidebar {
            position: relative;
            padding-bottom: 50px;
          }
          .date-range-clear-button {
            position: absolute;
            bottom: 8px;
            left: 8px;
            z-index: 10;
            width: auto;
          }
        `}</style>
        <div className={`rdrDateRangePickerWrapper ${(fromDate || toDate) ? 'with-clear-button' : ''}`}>
          <DateRangePicker
            ranges={state}
            onChange={handleSelect}
            months={2}
            direction="horizontal"
          />
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive date-range-clear-button"
              onClick={handleClear}
              data-testid="button-clear-dates-calendar"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
