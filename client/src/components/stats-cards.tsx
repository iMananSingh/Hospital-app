import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Clock, Users, Microscope } from "lucide-react";
import { Link } from "wouter";

interface StatsCardsProps {
  stats: {
    todayRevenue: number;
    pendingBills: number;
    opdPatients: number;
    labTests: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statsData = [
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.todayRevenue),
      change: "+12.5%",
      changeType: "positive" as const,
      icon: TrendingUp,
      bgColor: "bg-healthcare-green/10",
      iconColor: "text-healthcare-green",
      testId: "stat-revenue"
    },
    {
      title: "Pending Bills",
      value: stats.pendingBills.toString(),
      change: "Requires attention",
      changeType: "warning" as const,
      icon: Clock,
      bgColor: "bg-alert-orange/10",
      iconColor: "text-alert-orange",
      testId: "stat-pending"
    },
    {
      title: "OPD Patients",
      value: stats.opdPatients.toString(),
      change: "Today",
      changeType: "neutral" as const,
      icon: Users,
      bgColor: "bg-medical-blue/10",
      iconColor: "text-medical-blue",
      testId: "stat-opd",
      clickable: true,
      linkTo: "/opd-list"
    },
    {
      title: "Lab Tests",
      value: stats.labTests.toString(),
      change: "Completed",
      changeType: "positive" as const,
      icon: Microscope,
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-500",
      testId: "stat-labs"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {statsData.map((stat) => {
        const CardWrapper = (stat as any).clickable ? 
          ({ children, ...props }: any) => (
            <Link href={(stat as any).linkTo}>
              <Card {...props} className={`shadow-sm cursor-pointer hover:shadow-md transition-shadow ${props.className || ''}`}>
                {children}
              </Card>
            </Link>
          ) : 
          ({ children, ...props }: any) => <Card {...props}>{children}</Card>;

        return (
          <CardWrapper key={stat.title} data-testid={stat.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-text-dark mt-1" data-testid={`${stat.testId}-value`}>
                    {stat.value}
                  </p>
                  <p className={`text-sm font-medium mt-2 ${
                    stat.changeType === "positive" ? "text-healthcare-green" :
                    stat.changeType === "warning" ? "text-alert-orange" :
                    "text-medical-blue"
                  }`}>
                    {stat.changeType === "positive" && <TrendingUp className="w-3 h-3 inline mr-1" />}
                    {stat.changeType === "warning" && <Clock className="w-3 h-3 inline mr-1" />}
                    {stat.change}
                  </p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </CardWrapper>
        );
      })}
    </div>
  );
}
