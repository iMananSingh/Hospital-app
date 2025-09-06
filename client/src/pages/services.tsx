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
  Settings
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RoomType, Room, Service, PathologyCategory, DynamicPathologyTest } from "@shared/schema";

export default function ServiceManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rooms");
  const [roomsSubTab, setRoomsSubTab] = useState("room-types");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>("");
  const [isRoomTypeDialogOpen, setIsRoomTypeDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceDoctors, setServiceDoctors] = useState<{id: string, share: number}[]>([]);

  // Pathology states
  const [pathologySubTab, setPathologySubTab] = useState("categories");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PathologyCategory | null>(null);
  const [editingTest, setEditingTest] = useState<DynamicPathologyTest | null>(null);
  const [uploadData, setUploadData] = useState<string>("");

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

  // Fetch doctors for service assignment
  const { data: doctors = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors"],
  });

  // Fetch pathology categories
  const { data: pathologyCategories = [] } = useQuery<PathologyCategory[]>({
    queryKey: ["/api/pathology-categories"],
  });

  // Fetch dynamic pathology tests
  const { data: dynamicPathologyTests = [] } = useQuery<DynamicPathologyTest[]>({
    queryKey: ["/api/dynamic-pathology-tests"],
  });

  // Fetch combined pathology data (hardcoded + dynamic)
  const { data: combinedPathologyData, isLoading: combinedLoading } = useQuery({
    queryKey: ["/api/pathology-tests/combined"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const roomTypeForm = useForm({
    defaultValues: {
      name: "",
      category: "",
      dailyCost: 0,
      totalBeds: 0,
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
      doctors: [],
    },
  });

  const categoryForm = useForm({
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const testForm = useForm({
    defaultValues: {
      categoryId: "",
      testName: "",
      price: 0,
      normalRange: "",
      description: "",
      isActive: true,
    },
  });

  const createRoomTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEditing = editingRoomType !== null;
      const url = isEditing ? `/api/room-types/${editingRoomType.id}` : "/api/room-types";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} room type: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      setIsRoomTypeDialogOpen(false);
      roomTypeForm.reset();
      const wasEditing = editingRoomType !== null;
      setEditingRoomType(null);
      toast({
        title: "Success",
        description: `Room type ${wasEditing ? 'updated' : 'created'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save room type",
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
      const isEditing = editingService !== null;
      const url = isEditing ? `/api/services/${editingService.id}` : "/api/services";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} service: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsServiceDialogOpen(false);
      serviceForm.reset();
      const wasEditing = editingService !== null;
      setEditingService(null);
      setServiceDoctors([]);
      toast({
        title: "Success",
        description: `Service ${wasEditing ? 'updated' : 'created'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save service",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    },
  });

  const deleteRoomTypeMutation = useMutation({
    mutationFn: async (roomTypeId: string) => {
      const response = await fetch(`/api/room-types/${roomTypeId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete room type: ${errorText}`);
      }
      // For 204 responses, there might not be JSON content
      if (response.status === 204) {
        return { success: true };
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Success",
        description: "Room type deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete room type",
        variant: "destructive",
      });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete room: ${errorText}`);
      }
      // For 204 responses, there might not be JSON content
      if (response.status === 204) {
        return { success: true };
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/room-types"] });
      toast({
        title: "Success",
        description: "Room deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete room",
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
    // For non-rooms services, allow price to be 0 if not provided
    const serviceData = {
      ...data,
      category: activeTab,
      price: activeTab !== 'rooms' && (!data.price || data.price === '') ? 0 : data.price,
      // Remove doctors field from service data as it's not part of the service schema
    };
    createServiceMutation.mutate(serviceData);
  };

  const openRoomTypeDialog = (roomType?: RoomType) => {
    if (roomType) {
      setEditingRoomType(roomType);
      roomTypeForm.reset({
        name: roomType.name,
        category: roomType.category,
        dailyCost: roomType.dailyCost,
        totalBeds: roomType.totalBeds || 0,
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
      roomForm.reset({
        roomNumber: "",
        roomTypeId: selectedRoomTypeId || "",
        floor: "",
        building: "",
        capacity: 1,
        isOccupied: false,
        isActive: true,
        notes: "",
      });
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
        doctors: [],
      });
      setServiceDoctors([]);
    } else {
      setEditingService(null);
      serviceForm.reset({
        name: "",
        category: activeTab,
        price: 0,
        description: "",
        isActive: true,
        doctors: [],
      });
      setServiceDoctors([]);
    }
    setIsServiceDialogOpen(true);
  };

  const addDoctorToService = () => {
    setServiceDoctors(prev => [...prev, { id: "", share: 0 }]);
  };

  const removeDoctorFromService = (index: number) => {
    setServiceDoctors(prev => prev.filter((_, i) => i !== index));
  };

  const updateDoctorShare = (index: number, field: "id" | "share", value: string | number) => {
    setServiceDoctors(prev => prev.map((doctor, i) => 
      i === index ? { ...doctor, [field]: value } : doctor
    ));
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
      case 'room':
        return <Bed className="h-4 w-4" />;
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
      case 'room':
        return 'bg-green-100 text-green-800';
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
      case 'misc':
        return <Settings className="h-4 w-4" />;
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
      case 'misc':
        return 'bg-purple-100 text-purple-800';
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
      case 'misc':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const serviceCategories = [
    { key: 'rooms', label: 'Rooms & Accommodation', icon: Building2 },
    { key: 'pathology', label: 'Pathology Tests', icon: Activity },
    { key: 'diagnostics', label: 'Diagnostic Services', icon: Heart },
    { key: 'procedures', label: 'Medical Procedures', icon: Stethoscope },
    { key: 'operations', label: 'Surgical Operations', icon: Scissors },
    { key: 'misc', label: 'Miscellaneous Services', icon: Settings }
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


        {/* Content based on active tab */}
        {activeTab === 'rooms' ? (
          <div className="space-y-4">
            {/* Main Rooms Navigation */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                onClick={() => {setRoomsSubTab("room-types"); setSelectedRoomTypeId("");}}
                variant={roomsSubTab === "room-types" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Room Types
              </Button>
              <Button
                onClick={() => {setRoomsSubTab("rooms"); setSelectedRoomTypeId("");}}
                variant={roomsSubTab === "rooms" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Bed className="h-4 w-4" />
                All Rooms
              </Button>
            </div>

            {/* Room Types Section */}
            {roomsSubTab === "room-types" && (
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
                          <TableHead>Total Beds</TableHead>
                          <TableHead>Occupied Beds</TableHead>
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
                            <TableCell>{roomType.totalBeds || 0}</TableCell>
                            <TableCell>{roomType.occupiedBeds || 0}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => openRoomTypeDialog(roomType)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete "${roomType.name}"? This action cannot be undone.`)) {
                                      deleteRoomTypeMutation.mutate(roomType.id);
                                    }
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  disabled={deleteRoomTypeMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
            )}

            {/* Rooms Section */}
            {roomsSubTab === "rooms" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Individual Rooms {selectedRoomTypeId && `- ${roomTypes.find(rt => rt.id === selectedRoomTypeId)?.name}`}</CardTitle>
                  <Button
                    onClick={() => openRoomDialog()}
                    className="flex items-center gap-2"
                    data-testid="button-add-room"
                  >
                    <Plus className="h-4 w-4" />
                    Add Room
                  </Button>
                </CardHeader>

                {/* Sub-navigation for Rooms */}
                <div className="px-6 pb-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setSelectedRoomTypeId("")}
                      variant={selectedRoomTypeId === "" ? "default" : "outline"}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Bed className="h-4 w-4" />
                      All Rooms
                    </Button>
                    {roomTypes.map((roomType) => (
                      <Button
                        key={roomType.id}
                        onClick={() => setSelectedRoomTypeId(roomType.id)}
                        variant={selectedRoomTypeId === roomType.id ? "default" : "outline"}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {getCategoryIcon(roomType.category)}
                        {roomType.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <CardContent>
                  {(() => {
                    const filteredRooms = selectedRoomTypeId 
                      ? rooms.filter(room => room.roomTypeId === selectedRoomTypeId)
                      : rooms;

                    return filteredRooms.length > 0 ? (
                      <div className="grid grid-cols-6 gap-4">
                        {filteredRooms.map((room) => (
                          <div
                            key={room.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                            style={{ aspectRatio: '3/1' }}
                          >
                            <div className="flex flex-col justify-center">
                              <span className="font-medium text-sm text-gray-900">
                                {room.roomNumber}
                              </span>
                            </div>
                            <Button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete room "${room.roomNumber}"? This action cannot be undone.`)) {
                                  deleteRoomMutation.mutate(room.id);
                                }
                              }}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                              disabled={deleteRoomMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Bed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                          {selectedRoomTypeId ? `No ${roomTypes.find(rt => rt.id === selectedRoomTypeId)?.name} rooms defined yet` : `No individual rooms defined yet`}
                        </p>
                        <Button
                          onClick={() => openRoomDialog()}
                          className="mt-4"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Room
                        </Button>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
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
                        <TableCell>
                          {(service.category !== 'rooms' && service.price === 0) 
                            ? <Badge variant="outline" className="text-purple-700 border-purple-300">Variable</Badge>
                            : `₹${service.price.toLocaleString()}`
                          }
                        </TableCell>
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
                          <div className="flex gap-2">
                            <Button
                              onClick={() => openServiceDialog(service)}
                              size="sm"
                              variant="outline"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete "${service.name}"? This action cannot be undone.`)) {
                                  deleteServiceMutation.mutate(service.id);
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deleteServiceMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

        {/* Other Services Section */}
        {activeTab !== 'rooms' && activeTab !== 'pathology' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">{activeTab} Services</CardTitle>
              <Button
                onClick={() => openServiceDialog()}
                className="flex items-center gap-2"
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
                        <TableCell>{service.description || '-'}</TableCell>
                        <TableCell>
                          <Badge className={service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {service.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => openServiceDialog(service)}
                              size="sm"
                              variant="outline"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete "${service.name}"? This action cannot be undone.`)) {
                                  deleteServiceMutation.mutate(service.id);
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deleteServiceMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                      <SelectItem value="room">Room</SelectItem>
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
                <Label>Total Beds *</Label>
                <Input
                  type="number"
                  {...roomTypeForm.register("totalBeds", { valueAsNumber: true })}
                  placeholder="Enter total number of beds"
                  data-testid="input-total-beds"
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={roomForm.handleSubmit(onRoomSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Room Number *</Label>
                <Input
                  {...roomForm.register("roomNumber")}
                  placeholder="e.g., GW-1, ICU-1, PR-1, AR-1"
                  data-testid="input-room-number"
                />
              </div>

              <div className="space-y-2">
                <Label>Room Type *</Label>
                <Select
                  value={roomForm.watch("roomTypeId")}
                  onValueChange={(value) => roomForm.setValue("roomTypeId", value)}
                  disabled={!!selectedRoomTypeId && !editingRoom}
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
                {selectedRoomTypeId && !editingRoom && (
                  <p className="text-sm text-gray-500 mt-1">
                    Auto-selected: {roomTypes.find(rt => rt.id === selectedRoomTypeId)?.name}
                  </p>
                )}
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    placeholder={`e.g., ${activeTab === 'diagnostics' ? 'ECG' : activeTab === 'procedures' ? 'Dressing' : activeTab === 'operations' ? 'Appendectomy' : activeTab === 'misc' ? 'Ambulance Service' : 'Service Name'}`}
                    data-testid="input-service-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price (₹) {activeTab !== 'rooms' ? '(Optional - Variable Pricing)' : '*'}</Label>
                  <Input
                    type="number"
                    {...serviceForm.register("price", { valueAsNumber: true })}
                    placeholder={activeTab !== 'rooms' ? 'Leave blank for variable pricing' : 'Enter price'}
                    data-testid="input-service-price"
                  />
                  {activeTab !== 'rooms' && (
                    <p className="text-sm text-gray-500">Price can be entered when adding to patient if left blank</p>
                  )}
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

              {/* Doctor Assignment Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Doctor Assignment (Optional)</Label>
                  {serviceDoctors.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDoctorToService}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Doctor
                    </Button>
                  )}
                </div>

                {serviceDoctors.map((doctor, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        <div className="space-y-2">
                          <Label>Doctor {index + 1}</Label>
                          <Select
                            value={doctor.id}
                            onValueChange={(value) => updateDoctorShare(index, "id", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select doctor" />
                            </SelectTrigger>
                            <SelectContent>
                              {doctors.map((doc: any) => (
                                <SelectItem key={doc.id} value={doc.id}>
                                  {doc.name} - {doc.specialization}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {serviceDoctors.length > 1 && (
                          <div className="space-y-2">
                            <Label>Share (₹)</Label>
                            <Input
                              type="number"
                              value={doctor.share || ""}
                              onChange={(e) => updateDoctorShare(index, "share", parseFloat(e.target.value) || 0)}
                              placeholder="Doctor's share amount"
                            />
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDoctorFromService(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {index === serviceDoctors.length - 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addDoctorToService}
                        className="flex items-center gap-2 mt-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Doctor
                      </Button>
                    )}
                  </div>
                ))}

                {serviceDoctors.length > 1 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium">Cost Distribution</p>
                    <p className="text-sm text-blue-600">
                      Total service price: ₹{serviceForm.watch("price") || 0}
                    </p>
                    <p className="text-sm text-blue-600">
                      Total doctor shares: ₹{serviceDoctors.reduce((sum, doc) => sum + (doc.share || 0), 0)}
                    </p>
                    <p className="text-sm text-blue-600">
                      Hospital share: ₹{Math.max(0, (serviceForm.watch("price") || 0) - serviceDoctors.reduce((sum, doc) => sum + (doc.share || 0), 0))}
                    </p>
                  </div>
                )}
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

        {/* Pathology Category Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Add Pathology Category'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={categoryForm.handleSubmit(async (data) => {
              try {
                const url = editingCategory 
                  ? `/api/pathology-categories/${editingCategory.id}`
                  : '/api/pathology-categories';
                const method = editingCategory ? 'PUT' : 'POST';

                const response = await fetch(url, {
                  method,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hospital_token')}`
                  },
                  body: JSON.stringify(data)
                });

                if (response.ok) {
                  queryClient.invalidateQueries({ queryKey: ['/api/pathology-categories'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/pathology-tests/combined'] });
                  toast({ title: 'Success', description: `Category ${editingCategory ? 'updated' : 'created'} successfully` });
                  setIsCategoryDialogOpen(false);
                  setEditingCategory(null);
                  categoryForm.reset();
                } else {
                  toast({ title: 'Error', description: 'Failed to save category', variant: 'destructive' });
                }
              } catch (error) {
                toast({ title: 'Error', description: 'Failed to save category', variant: 'destructive' });
              }
            })} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name *</Label>
                <Input
                  {...categoryForm.register("name")}
                  placeholder="e.g., Cardiology Tests"
                  data-testid="input-category-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  {...categoryForm.register("description")}
                  placeholder="Optional description"
                  data-testid="textarea-category-description"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCategoryDialogOpen(false);
                    setEditingCategory(null);
                    categoryForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Pathology Test Dialog */}
        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTest ? 'Edit Test' : 'Add Pathology Test'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={testForm.handleSubmit(async (data) => {
              try {
                const url = editingTest 
                  ? `/api/dynamic-pathology-tests/${editingTest.id}`
                  : '/api/dynamic-pathology-tests';
                const method = editingTest ? 'PUT' : 'POST';

                const response = await fetch(url, {
                  method,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hospital_token')}`
                  },
                  body: JSON.stringify(data)
                });

                if (response.ok) {
                  queryClient.invalidateQueries({ queryKey: ['/api/dynamic-pathology-tests'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/pathology-tests/combined'] });
                  toast({ title: 'Success', description: `Test ${editingTest ? 'updated' : 'created'} successfully` });
                  setIsTestDialogOpen(false);
                  setEditingTest(null);
                  testForm.reset();
                } else {
                  toast({ title: 'Error', description: 'Failed to save test', variant: 'destructive' });
                }
              } catch (error) {
                toast({ title: 'Error', description: 'Failed to save test', variant: 'destructive' });
              }
            })} className="space-y-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={testForm.watch("categoryId")}
                  onValueChange={(value) => testForm.setValue("categoryId", value)}
                  data-testid="select-test-category"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {combinedPathologyData?.categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} {category.isHardcoded ? '(System)' : '(Custom)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Test Name *</Label>
                <Input
                  {...testForm.register("testName")}
                  placeholder="e.g., Blood Glucose Test"
                  data-testid="input-test-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  {...testForm.register("price", { valueAsNumber: true })}
                  placeholder="Enter test price"
                  data-testid="input-test-price"
                />
              </div>

              <div className="space-y-2">
                <Label>Normal Range</Label>
                <Input
                  {...testForm.register("normalRange")}
                  placeholder="e.g., 70-100 mg/dL"
                  data-testid="input-test-normal-range"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  {...testForm.register("description")}
                  placeholder="Optional test description"
                  data-testid="textarea-test-description"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsTestDialogOpen(false);
                    setEditingTest(null);
                    testForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTest ? 'Update Test' : 'Add Test'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* JSON Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk Upload Pathology Tests</DialogTitle>
              <p className="text-sm text-gray-600">
                Upload tests in JSON format. The system will create categories and tests as needed.
              </p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>JSON Data</Label>
                <Textarea
                  value={uploadData}
                  onChange={(e) => setUploadData(e.target.value)}
                  placeholder={`{
  "categories": [
    {
      "name": "Blood Tests",
      "description": "Blood analysis tests",
      "tests": [
        {
          "test_name": "Complete Blood Count",
          "price": 500,
          "normal_range": "70-100 mg/dL",
          "description": "Full blood analysis"
        }
      ]
    }
  ]
}`}
                  rows={12}
                  className="font-mono text-sm"
                  data-testid="textarea-upload-json"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setUploadData("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const data = JSON.parse(uploadData);
                      const response = await fetch('/api/pathology-tests/bulk-upload', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('hospital_token')}`
                        },
                        body: JSON.stringify(data)
                      });

                      if (response.ok) {
                        const result = await response.json();
                        queryClient.invalidateQueries({ queryKey: ['/api/pathology-categories'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/dynamic-pathology-tests'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/pathology-tests/combined'] });
                        toast({ 
                          title: 'Success', 
                          description: `Uploaded ${result.categories?.length || 0} categories and ${result.tests?.length || 0} tests` 
                        });
                        setIsUploadDialogOpen(false);
                        setUploadData("");
                      } else {
                        toast({ title: 'Error', description: 'Failed to upload data', variant: 'destructive' });
                      }
                    } catch (error) {
                      toast({ title: 'Error', description: 'Invalid JSON format', variant: 'destructive' });
                    }
                  }}
                >
                  Upload Tests
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}