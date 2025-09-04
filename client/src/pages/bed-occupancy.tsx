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
      <div className="space-y-6">
        <TopBar title="Bed Occupancy" />
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <TopBar title="Bed Occupancy" />
        
        <div className="p-6">
          
                      

          {/* Room Types and Rooms */}
          <div className="space-y-6">
            {bedOccupancy.map((roomType) => (
              <Card key={roomType.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getCategoryIcon(roomType.category)}
                    {roomType.name}
                    <Badge className={getCategoryColor(roomType.category)} variant="secondary">
                      {roomType.category}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {roomType.occupiedBeds} of {roomType.totalBeds} beds occupied • ₹{roomType.dailyCost.toLocaleString()} per day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roomType.rooms.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {roomType.rooms.map((room) => (
                        <Tooltip key={room.id}>
                          <TooltipTrigger asChild>
                            <Card 
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                room.isOccupied 
                                  ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                  : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                              }`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Bed className={`h-4 w-4 ${
                                      room.isOccupied ? 'text-green-600' : 'text-blue-600'
                                    }`} />
                                    <span className="font-medium text-sm">
                                      {room.roomNumber}
                                    </span>
                                  </div>
                                  <Badge 
                                    variant={room.isOccupied ? "default" : "secondary"}
                                    className={`text-xs ${
                                      room.isOccupied 
                                        ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                        : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                    }`}
                                  >
                                    {room.isOccupied ? 'Occupied' : 'Available'}
                                  </Badge>
                                </div>
                                {room.floor && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Floor {room.floor}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="p-2">
                              <p className="font-medium">Room {room.roomNumber}</p>
                              {room.floor && <p className="text-sm">Floor: {room.floor}</p>}
                              {room.building && <p className="text-sm">Building: {room.building}</p>}
                              <p className="text-sm">Capacity: {room.capacity}</p>
                              {room.isOccupied && room.occupyingPatient && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
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