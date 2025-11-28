import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Bed, 
  Building2,
  Users,
  Activity
} from "lucide-react";

interface OccupyingPatient {
  name: string;
  patientId: string;
}

interface Room {
  id: string;
  roomNumber: string;
  floor: string;
  building: string;
  capacity: number;
  isOccupied: boolean;
  isActive: boolean;
  notes: string;
  occupyingPatient: OccupyingPatient | null;
}

interface RoomType {
  id: string;
  name: string;
  category: string;
  dailyCost: number;
  totalBeds: number;
  occupiedBeds: number;
  isActive: boolean;
  rooms: Room[];
}

export default function BedOccupancyPage() {
  const { data: bedOccupancy = [], isLoading } = useQuery<RoomType[]>({
    queryKey: ["/api/inpatients/bed-occupancy"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "icu":
        return <Activity className="h-4 w-4" />;
      case "emergency":
        return <Users className="h-4 w-4" />;
      case "ward":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Bed className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "icu":
        return "bg-red-100 text-red-800 border-red-200";
      case "emergency":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "ward":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "room":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title="Bed Occupancy" />
        <div className="px-6 pb-6 pt-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div>
        <TopBar title="Bed Occupancy" />
        
        <div className="px-6 pb-6 pt-4">
          {/* Legend */}
          <div className="flex items-center gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-rose-500 rounded"></div>
              <span className="text-sm font-medium">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span className="text-sm font-medium">Available</span>
            </div>
          </div>

          {/* Room Types and Rooms */}
          <div>
            {bedOccupancy.map((roomType) => (
              <Card key={roomType.id} className="rounded-lg border bg-card text-card-foreground shadow-sm mt-[24px] mb-[24px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getCategoryIcon(roomType.category)}
                    {roomType.name}
                    <Badge className={getCategoryColor(roomType.category)} variant="secondary">
                      {roomType.category}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {roomType.occupiedBeds || 0} of {roomType.totalBeds || 0} beds occupied • ₹{roomType.dailyCost.toLocaleString()} per day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roomType.rooms.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {roomType.rooms
                        .sort((a, b) => {
                          // Split room numbers into parts for proper sorting
                          const parseRoomNumber = (roomNumber: string) => {
                            // Match pattern like "NR-B-1" or "GW-01"
                            const match = roomNumber.match(/^(.+?)(\d+)$/);
                            if (match) {
                              return {
                                prefix: match[1], // "NR-B-" or "GW-"
                                number: parseInt(match[2], 10) // 1 or 1
                              };
                            }
                            return { prefix: roomNumber, number: 0 };
                          };
                          
                          const roomA = parseRoomNumber(a.roomNumber);
                          const roomB = parseRoomNumber(b.roomNumber);
                          
                          // First sort by prefix alphabetically
                          const prefixComparison = roomA.prefix.localeCompare(roomB.prefix);
                          if (prefixComparison !== 0) {
                            return prefixComparison;
                          }
                          
                          // Then sort by number numerically
                          return roomA.number - roomB.number;
                        })
                        .map((room) => (
                        <Tooltip key={room.id}>
                          <TooltipTrigger asChild>
                            <Card 
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                room.isOccupied 
                                  ? 'bg-rose-500 border-rose-600 hover:bg-rose-600 text-white' 
                                  : 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center gap-2">
                                    <Bed className="h-4 w-4 text-white" />
                                    <span className="font-medium text-sm text-white">
                                      {room.roomNumber}
                                    </span>
                                  </div>
                                </div>
                                {room.floor && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Floor {room.floor}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          </TooltipTrigger>
                          {room.isOccupied && (
                            <TooltipContent>
                              <div className="p-2">
                                {room.isOccupied && room.occupyingPatient && (
                                  <div>
                                    <p className="text-sm font-medium">
                                      {room.occupyingPatient.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {room.occupyingPatient.patientId}
                                    </p>
                                  </div>
                                )}
                                {room.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {room.notes}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Bed className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No rooms configured for this room type</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {bedOccupancy.length === 0 && (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Room Types Found</h3>
                  <p className="text-muted-foreground">
                    No room types are configured. Please add room types in the Services section.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}