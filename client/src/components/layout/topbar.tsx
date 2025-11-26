import { Search, Bell, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DateRangePickerWithPresets from "@/components/date-range-picker-with-presets";

interface TopBarProps {
  title: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onNewAction?: () => void;
  newActionLabel?: string;
  showNotifications?: boolean;
  notificationCount?: number;
  showDateFilter?: boolean;
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (date: string) => void;
  onToDateChange?: (date: string) => void;
  onTodayClick?: () => void;
  actions?: React.ReactNode;
}

export default function TopBar({
  title,
  searchPlaceholder = "Search...",
  onSearch,
  onNewAction,
  newActionLabel = "New",
  showNotifications = true,
  notificationCount = 0,
  showDateFilter = false,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onTodayClick,
  actions,
}: TopBarProps) {
  return (
    <header className="bg-background border-b border-border px-6 sticky top-0 z-50 h-[84px] flex items-center">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-text-dark" data-testid="page-title">
            {title}
          </h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Custom Actions */}
          {actions}
          
          {/* Date Range Filter */}
          {showDateFilter && (
            <DateRangePickerWithPresets
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={onFromDateChange}
              onToDateChange={onToDateChange}
              onTodayClick={onTodayClick}
            />
          )}
          
          {/* Search Bar */}
          {onSearch && (
            <div className="relative">
              <Input
                type="text"
                placeholder={searchPlaceholder}
                className="w-80 pl-10"
                onChange={(e) => onSearch(e.target.value)}
                data-testid="search-input"
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
            </div>
          )}
          
          {/* New Action Button */}
          {onNewAction && (
            <Button 
              onClick={onNewAction}
              className="bg-medical-blue hover:bg-medical-blue/90"
              data-testid="button-new-action"
            >
              <Plus className="w-4 h-4 mr-2" />
              {newActionLabel}
            </Button>
          )}
          
          {/* Notifications */}
          {showNotifications && (
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon"
                className="relative"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
                    data-testid="notification-count"
                  >
                    {notificationCount}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
