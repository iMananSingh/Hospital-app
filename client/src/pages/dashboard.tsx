import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/topbar";
import StatsCards from "@/components/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
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
        <StatsCards stats={stats ?? { todayRevenue: 0, pendingBills: 0, opdPatients: 0, labTests: 0 }} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">B</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">New bill generated</p>
                    <p className="text-xs text-text-muted">BILL-2024-0089 for Rajesh Kumar</p>
                  </div>
                  <p className="text-xs text-text-muted">2 min ago</p>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-healthcare-green rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">P</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">New patient registered</p>
                    <p className="text-xs text-text-muted">Priya Sharma - OPD</p>
                  </div>
                  <p className="text-xs text-text-muted">15 min ago</p>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">L</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Lab test completed</p>
                    <p className="text-xs text-text-muted">Blood test for Amit Singh</p>
                  </div>
                  <p className="text-xs text-text-muted">1 hour ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button className="p-4 bg-medical-blue text-white rounded-lg hover:bg-medical-blue/90 transition-colors" data-testid="quick-new-bill">
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
    </div>
  );
}
