import { useState } from "react";
import TopBar from "@/components/layout/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Billing() {
  const [leftActiveTab, setLeftActiveTab] = useState("opd");
  const [rightActiveTab, setRightActiveTab] = useState("credit");

  return (
    <div className="space-y-6">
      <TopBar 
        title="Revenue and Payments"
        searchPlaceholder="Search revenue data..."
        showNotifications={true}
        notificationCount={3}
      />
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Half - Service Revenue */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={leftActiveTab} onValueChange={setLeftActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="opd" data-testid="tab-opd">OPD</TabsTrigger>
                    <TabsTrigger value="lab" data-testid="tab-lab">Lab</TabsTrigger>
                    <TabsTrigger value="diagnostic" data-testid="tab-diagnostic">Diagnostic</TabsTrigger>
                    <TabsTrigger value="inpatient" data-testid="tab-inpatient">Inpatient</TabsTrigger>
                  </TabsList>
                  <TabsContent value="opd" className="mt-4 space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      OPD Revenue content will be displayed here
                    </div>
                  </TabsContent>
                  <TabsContent value="lab" className="mt-4 space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      Lab Revenue content will be displayed here
                    </div>
                  </TabsContent>
                  <TabsContent value="diagnostic" className="mt-4 space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      Diagnostic Revenue content will be displayed here
                    </div>
                  </TabsContent>
                  <TabsContent value="inpatient" className="mt-4 space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      Inpatient Revenue content will be displayed here
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Half - Payment Transactions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={rightActiveTab} onValueChange={setRightActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="credit" data-testid="tab-credit">Credit</TabsTrigger>
                    <TabsTrigger value="debit" data-testid="tab-debit">Debit</TabsTrigger>
                  </TabsList>
                  <TabsContent value="credit" className="mt-4 space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      Credit transactions will be displayed here
                    </div>
                  </TabsContent>
                  <TabsContent value="debit" className="mt-4 space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      Debit transactions will be displayed here
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}