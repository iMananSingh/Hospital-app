import { Search, Bell, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  title: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onNewAction?: () => void;
  newActionLabel?: string;
  showNotifications?: boolean;
  notificationCount?: number;
}

export default function TopBar({
  title,
  searchPlaceholder = "Search...",
  onSearch,
  onNewAction,
  newActionLabel = "New",
  showNotifications = true,
  notificationCount = 0,
}: TopBarProps) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="bg-surface border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
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
