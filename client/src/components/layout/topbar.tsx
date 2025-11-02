import { Search, Bell, Plus, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="bg-surface border-b border-border px-6 h-[73px] flex items-center sticky top-0 z-50">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-text-dark" data-testid="page-title">
            {title}
          </h2>
          <div className="flex items-center space-x-2 bg-muted px-3 py-1 rounded-full">
            <div className="w-4 h-4 text-text-muted">📅</div>
            <span className="text-sm text-text-muted" data-testid="current-date">
              {currentDate}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Custom Actions */}
          {actions}
          
          {/* Date Range Filter */}
          {showDateFilter && (
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 rounded-lg border">
              <CalendarDays className="w-4 h-4 text-text-muted" />
              <div className="flex items-center gap-2">
                <Label htmlFor="navbar-from-date" className="text-sm font-medium">From:</Label>
                <Input
                  id="navbar-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => onFromDateChange?.(e.target.value)}
                  className="w-36 text-sm"
                  data-testid="input-navbar-from-date"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="navbar-to-date" className="text-sm font-medium">To:</Label>
                <Input
                  id="navbar-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => onToDateChange?.(e.target.value)}
                  className="w-36 text-sm"
                  data-testid="input-navbar-to-date"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onTodayClick}
                data-testid="button-navbar-today"
              >
                Today
              </Button>
            </div>
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
