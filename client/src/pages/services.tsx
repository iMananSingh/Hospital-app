import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Bed,
  Home,
  Activity,
  AlertTriangle,
  Heart,
  Stethoscope,
  Syringe,
  Scissors,
  Truck,
  FileText
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RoomType, Room, Service } from "@shared/schema";

export default function ServiceManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rooms");
  const [isRoomTypeDialogOpen, setIsRoomTypeDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Fetch room types
  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ["/api/room-types"],
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  // Fetch services
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const roomTypeForm = useForm({
    defaultValues: {
      name: "",
      category: "",
      dailyCost: 0,
      description: "",
      isActive: true,
    },
  });

  const roomForm = useForm({
    defaultValues: {
      roomNumber: "",
      roomTypeId: "",
      floor: "",
      building: "",
      capacity: 1,
      isOccupied: false,
      isActive: true,
      notes: "",
    },
  });

  const serviceForm = useForm({
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      description: "",
      isActive: true,
    },
  });

  const createRoomTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/room-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create room type");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      setIsRoomTypeDialogOpen(false);
      roomTypeForm.reset();
      setEditingRoomType(null);
      toast({
        title: "Success",
        description: "Room type saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save room type",
        variant: "destructive",
      });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create room");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setIsRoomDialogOpen(false);
      roomForm.reset();
      setEditingRoom(null);
      toast({
        title: "Success",
        description: "Room saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save room",
        variant: "destructive",
      });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsServiceDialogOpen(false);
      serviceForm.reset();
      setEditingService(null);
      toast({
        title: "Success",
        description: "Service saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    },
  });

  const onRoomTypeSubmit = (data: any) => {
    createRoomTypeMutation.mutate(data);
  };

  const onRoomSubmit = (data: any) => {
    createRoomMutation.mutate(data);
  };

  const onServiceSubmit = (data: any) => {
    createServiceMutation.mutate({ ...data, category: activeTab });
  };

  const openRoomTypeDialog = (roomType?: RoomType) => {
    if (roomType) {
      setEditingRoomType(roomType);
      roomTypeForm.reset({
        name: roomType.name,
        category: roomType.category,
        dailyCost: roomType.dailyCost,
        description: roomType.description || "",
        isActive: roomType.isActive,
      });
    } else {
      setEditingRoomType(null);
      roomTypeForm.reset();
    }
    setIsRoomTypeDialogOpen(true);
  };

  const openRoomDialog = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      roomForm.reset({
        roomNumber: room.roomNumber,
        roomTypeId: room.roomTypeId,
        floor: room.floor || "",
        building: room.building || "",
        capacity: room.capacity,
        isOccupied: room.isOccupied,
        isActive: room.isActive,
        notes: room.notes || "",
      });
    } else {
      setEditingRoom(null);
      roomForm.reset();
    }
    setIsRoomDialogOpen(true);
  };

  const openServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      serviceForm.reset({
        name: service.name,
        category: service.category,
        price: service.price,
        description: service.description || "",
        isActive: service.isActive,
      });
    } else {
      setEditingService(null);
      serviceForm.reset({
        name: "",
        category: activeTab,
        price: 0,
        description: "",
        isActive: true,
      });
    }
    setIsServiceDialogOpen(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ward':
        return <Home className="h-4 w-4" />;
      case 'icu':
        return <Activity className="h-4 w-4" />;
      case 'emergency':
        return <AlertTriangle className="h-4 w-4" />;
      case 'ot':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Bed className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ward':
        return 'bg-blue-100 text-blue-800';
      case 'icu':
        return 'bg-red-100 text-red-800';
      case 'emergency':
        return 'bg-orange-100 text-orange-800';
      case 'ot':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceCategoryIcon = (category: string) => {
    switch (category) {
      case 'diagnostics':
        return <Heart className="h-4 w-4" />;
      case 'procedures':
        return <Stethoscope className="h-4 w-4" />;
      case 'operations':
        return <Scissors className="h-4 w-4" />;
      case 'ambulance':
        return <Truck className="h-4 w-4" />;
      case 'mlc':
        return <FileText className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getServiceCategoryColor = (category: string) => {
    switch (category) {
      case 'diagnostics':
        return 'bg-pink-100 text-pink-800';
      case 'procedures':
        return 'bg-green-100 text-green-800';
      case 'operations':
        return 'bg-indigo-100 text-indigo-800';
      case 'ambulance':
        return 'bg-yellow-100 text-yellow-800';
      case 'mlc':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'rooms':
        return <Building2 className="h-4 w-4" />;
      case 'diagnostics':
        return <Heart className="h-4 w-4" />;
      case 'procedures':
        return <Stethoscope className="h-4 w-4" />;
      case 'operations':
        return <Scissors className="h-4 w-4" />;
      case 'ambulance':
        return <Truck className="h-4 w-4" />;
      case 'mlc':
        return <FileText className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const serviceCategories = [
    { key: 'rooms', label: 'Rooms & Accommodation', icon: Building2 },
    { key: 'diagnostics', label: 'Diagnostic Services', icon: Heart },
    { key: 'procedures', label: 'Medical Procedures', icon: Stethoscope },
    { key: 'operations', label: 'Surgical Operations', icon: Scissors },
    { key: 'ambulance', label: 'Ambulance Services', icon: Truck },
    { key: 'mlc', label: 'MLC Services', icon: FileText }
  ];

  const filteredServices = services.filter(service => service.category === activeTab);

  const occupiedRooms = rooms.filter(room => room.isOccupied).length;
  const availableRooms = rooms.filter(room => !room.isOccupied && room.isActive).length;

  return (
    <div className="space-y-6">
      <TopBar 
        title="Service Management"
      />
      
      <div className="p-6">
        {/* Service Category Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {serviceCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.key}
                  onClick={() => setActiveTab(category.key)}
                  variant={activeTab === category.key ? "default" : "outline"}
                  className="flex items-center gap-2"
                  data-testid={`tab-${category.key}`}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Statistics Cards - Dynamic based on active tab */}
        {activeTab === 'rooms' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Room Types</p>
                    <p className="text-2xl font-bold text-gray-900">{roomTypes.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Bed className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                    <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Occupied Rooms</p>
                    <p className="text-2xl font-bold text-gray-900">{occupiedRooms}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Home className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Available Rooms</p>
                    <p className="text-2xl font-bold text-gray-900">{availableRooms}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  {getServiceCategoryIcon(activeTab)}
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Services</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredServices.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Services</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredServices.filter(s => s.isActive).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Inactive Services</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredServices.filter(s => !s.isActive).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'rooms' ? (
          <Tabs defaultValue="room-types" className="space-y-4">
            <TabsList>
              <TabsTrigger value="room-types">Room Types</TabsTrigger>
              <TabsTrigger value="rooms">Rooms</TabsTrigger>
            </TabsList>

          <TabsContent value="room-types">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Room Types</CardTitle>
                <Button
                  onClick={() => openRoomTypeDialog()}
                  className="flex items-center gap-2"
                  data-testid="button-add-room-type"
                >
                  <Plus className="h-4 w-4" />
                  Add Room Type
                </Button>
              </CardHeader>
              <CardContent>
                {roomTypes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Daily Cost</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roomTypes.map((roomType) => (
                        <TableRow key={roomType.id}>
                          <TableCell className="font-medium">{roomType.name}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(roomType.category)} variant="secondary">
                              <div className="flex items-center gap-1">
                                {getCategoryIcon(roomType.category)}
                                {roomType.category}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>₹{roomType.dailyCost.toLocaleString()}</TableCell>
                          <TableCell>{roomType.description || "N/A"}</TableCell>
                          <TableCell>
                            <Badge 
                              className={roomType.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} 
                              variant="secondary"
                            >
                              {roomType.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => openRoomTypeDialog(roomType)}
                              size="sm"
                              variant="outline"
                              className="mr-2"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No room types defined yet</p>
                    <Button
                      onClick={() => openRoomTypeDialog()}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Room Type
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rooms">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Rooms</CardTitle>
                <Button
                  onClick={() => openRoomDialog()}
                  className="flex items-center gap-2"
                  data-testid="button-add-room"
                >
                  <Plus className="h-4 w-4" />
                  Add Room
                </Button>
              </CardHeader>
              <CardContent>
                {rooms.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room Number</TableHead>
                        <TableHead>Room Type</TableHead>
                        <TableHead>Floor</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Occupancy</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rooms.map((room) => {
                        const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
                        return (
                          <TableRow key={room.id}>
                            <TableCell className="font-medium">{room.roomNumber}</TableCell>
                            <TableCell>{roomType?.name || "Unknown"}</TableCell>
                            <TableCell>{room.floor || "N/A"}</TableCell>
                            <TableCell>{room.building || "N/A"}</TableCell>
                            <TableCell>{room.capacity}</TableCell>
                            <TableCell>
                              <Badge 
                                className={room.isOccupied ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} 
                                variant="secondary"
                              >
                                {room.isOccupied ? 'Occupied' : 'Available'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={room.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} 
                                variant="secondary"
                              >
                                {room.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                onClick={() => openRoomDialog(room)}
                                size="sm"
                                variant="outline"
                                className="mr-2"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Bed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No rooms defined yet</p>
                    <Button
                      onClick={() => openRoomDialog()}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Room
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getServiceCategoryIcon(activeTab)}
                {serviceCategories.find(cat => cat.key === activeTab)?.label}
              </CardTitle>
              <Button
                onClick={() => openServiceDialog()}
                className="flex items-center gap-2"
                data-testid={`button-add-${activeTab}`}
              >
                <Plus className="h-4 w-4" />
                Add Service
              </Button>
            </CardHeader>
            <CardContent>
              {filteredServices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>₹{service.price.toLocaleString()}</TableCell>
                        <TableCell>{service.description || "N/A"}</TableCell>
                        <TableCell>
                          <Badge 
                            className={service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} 
                            variant="secondary"
                          >
                            {service.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => openServiceDialog(service)}
                            size="sm"
                            variant="outline"
                            className="mr-2"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  {getServiceCategoryIcon(activeTab)}
                  <p className="text-gray-500 mt-4">No {activeTab} services defined yet</p>
                  <Button
                    onClick={() => openServiceDialog()}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Service
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Room Type Dialog */}
        <Dialog open={isRoomTypeDialogOpen} onOpenChange={setIsRoomTypeDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRoomType ? 'Edit Room Type' : 'Add Room Type'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={roomTypeForm.handleSubmit(onRoomTypeSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Room Type Name *</Label>
                  <Input
                    {...roomTypeForm.register("name")}
                    placeholder="e.g., General Ward"
                    data-testid="input-room-type-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={roomTypeForm.watch("category")}
                    onValueChange={(value) => roomTypeForm.setValue("category", value)}
                    data-testid="select-room-category"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ward">Ward</SelectItem>
                      <SelectItem value="icu">ICU</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="ot">Operation Theater</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Daily Cost (₹) *</Label>
                <Input
                  type="number"
                  {...roomTypeForm.register("dailyCost", { valueAsNumber: true })}
                  placeholder="Enter daily cost"
                  data-testid="input-daily-cost"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  {...roomTypeForm.register("description")}
                  placeholder="Optional description of the room type"
                  data-testid="textarea-description"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRoomTypeDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRoomTypeMutation.isPending}
                >
                  {createRoomTypeMutation.isPending 
                    ? "Saving..." 
                    : editingRoomType 
                      ? "Update Room Type" 
                      : "Add Room Type"
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Room Dialog */}
        <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={roomForm.handleSubmit(onRoomSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Room Number *</Label>
                  <Input
                    {...roomForm.register("roomNumber")}
                    placeholder="e.g., 101, A-204"
                    data-testid="input-room-number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Room Type *</Label>
                  <Select
                    value={roomForm.watch("roomTypeId")}
                    onValueChange={(value) => roomForm.setValue("roomTypeId", value)}
                    data-testid="select-room-type"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((roomType) => (
                        <SelectItem key={roomType.id} value={roomType.id}>
                          {roomType.name} - ₹{roomType.dailyCost}/day
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input
                    {...roomForm.register("floor")}
                    placeholder="e.g., Ground, 1st"
                    data-testid="input-floor"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Building</Label>
                  <Input
                    {...roomForm.register("building")}
                    placeholder="e.g., Main, Block A"
                    data-testid="input-building"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Capacity *</Label>
                  <Input
                    type="number"
                    {...roomForm.register("capacity", { valueAsNumber: true })}
                    placeholder="Number of beds"
                    data-testid="input-capacity"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  {...roomForm.register("notes")}
                  placeholder="Optional notes about the room"
                  data-testid="textarea-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRoomDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRoomMutation.isPending}
                >
                  {createRoomMutation.isPending 
                    ? "Saving..." 
                    : editingRoom 
                      ? "Update Room" 
                      : "Add Room"
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Service Dialog */}
        <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Edit Service' : `Add ${serviceCategories.find(cat => cat.key === activeTab)?.label} Service`}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input
                    {...serviceForm.register("name")}
                    placeholder={`e.g., ${activeTab === 'diagnostics' ? 'ECG' : activeTab === 'procedures' ? 'Dressing' : activeTab === 'operations' ? 'Appendectomy' : activeTab === 'ambulance' ? 'Emergency Transport' : 'MLC Report'}`}
                    data-testid="input-service-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price (₹) *</Label>
                  <Input
                    type="number"
                    {...serviceForm.register("price", { valueAsNumber: true })}
                    placeholder="Enter price"
                    data-testid="input-service-price"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  {...serviceForm.register("description")}
                  placeholder="Optional description of the service"
                  data-testid="textarea-service-description"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsServiceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createServiceMutation.isPending}
                >
                  {createServiceMutation.isPending 
                    ? "Saving..." 
                    : editingService 
                      ? "Update Service" 
                      : "Add Service"
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}