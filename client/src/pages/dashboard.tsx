import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/topbar";
import StatsCards from "@/components/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FakeBillDialog } from "@/components/fake-bill-dialog";

interface DashboardStats {
  opdPatients: number;
  inpatients: number;
  labTests: number;
  diagnostics: number;
}

interface Activity {
  id: string;
  activityType: string;
  title: string;
  description: string;
  entityType: string;
  createdAt: string;
  userName: string;
}

export default function Dashboard() {
  const [isFakeBillDialogOpen, setIsFakeBillDialogOpen] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
  });

  const { data: recentActivities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/dashboard/recent-activities"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch("/api/dashboard/recent-activities", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch recent activities");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TopBar 
          title="Dashboard & Reports"
          showNotifications={true}
          notificationCount={3}
        />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar 
        title="Dashboard & Reports"
        showNotifications={true}
        notificationCount={3}
      />
      
      <div className="p-6 space-y-6">
        <StatsCards stats={stats || { opdPatients: 0, inpatients: 0, labTests: 0, diagnostics: 0 }} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No recent activities</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'bill_created':
                          return { icon: 'B', color: 'bg-medical-blue' };
                        case 'patient_registered':
                          return { icon: 'P', color: 'bg-healthcare-green' };
                        case 'lab_test_ordered':
                          return { icon: 'L', color: 'bg-purple-500' };
                        case 'lab_test_completed':
                          return { icon: 'T', color: 'bg-orange-500' };
                        case 'opd_scheduled':
                          return { icon: 'O', color: 'bg-blue-500' };
                        case 'service_scheduled':
                          return { icon: 'S', color: 'bg-indigo-500' };
                        case 'room_type_created':
                        case 'room_type_updated':
                        case 'room_type_deleted':
                          return { icon: 'RT', color: 'bg-green-500' };
                        case 'room_created':
                        case 'room_updated':
                        case 'room_deleted':
                          return { icon: 'R', color: 'bg-teal-500' };
                        case 'service_created':
                        case 'service_updated':
                        case 'service_deleted':
                          return { icon: 'SV', color: 'bg-pink-500' };
                        default:
                          return { icon: 'A', color: 'bg-gray-500' };
                      }
                    };

                    const formatTimeAgo = (dateString: string) => {
                      const now = new Date();
                      const date = new Date(dateString);
                      const diffInMs = now.getTime() - date.getTime();
                      const diffInMins = Math.floor(diffInMs / (1000 * 60));
                      const diffInHours = Math.floor(diffInMins / 60);
                      const diffInDays = Math.floor(diffInHours / 24);

                      if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                      if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                      if (diffInMins > 0) return `${diffInMins} min${diffInMins > 1 ? 's' : ''} ago`;
                      return 'Just now';
                    };

                    const { icon, color } = getActivityIcon(activity.activityType);

                    return (
                      <div key={activity.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                        <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                          <span className="text-white text-xs">{icon}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-text-muted">{activity.description}</p>
                        </div>
                        <p className="text-xs text-text-muted">{formatTimeAgo(activity.createdAt)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsFakeBillDialogOpen(true)}
                  className="p-4 bg-medical-blue text-white rounded-lg hover:bg-medical-blue/90 transition-colors" 
                  data-testid="quick-new-bill"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">New Bill</div>
                    <div className="text-sm opacity-90">Create invoice</div>
                  </div>
                </button>
                
                <button className="p-4 bg-healthcare-green text-white rounded-lg hover:bg-healthcare-green/90 transition-colors" data-testid="quick-new-patient">
                  <div className="text-center">
                    <div className="text-lg font-semibold">Add Patient</div>
                    <div className="text-sm opacity-90">Register new</div>
                  </div>
                </button>
                
                <button className="p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-500/90 transition-colors" data-testid="quick-new-test">
                  <div className="text-center">
                    <div className="text-lg font-semibold">Lab Test</div>
                    <div className="text-sm opacity-90">Order test</div>
                  </div>
                </button>
                
                <button className="p-4 bg-alert-orange text-white rounded-lg hover:bg-alert-orange/90 transition-colors" data-testid="quick-view-pending">
                  <div className="text-center">
                    <div className="text-lg font-semibold">Pending</div>
                    <div className="text-sm opacity-90">View bills</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fake Bill Dialog */}
      <FakeBillDialog 
        isOpen={isFakeBillDialogOpen}
        onClose={() => setIsFakeBillDialogOpen(false)}
      />
    </div>
  );
}
