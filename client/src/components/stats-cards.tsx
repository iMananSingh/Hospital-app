import { Card, CardContent } from "@/components/ui/card";
import { Users, Bed, Microscope, Stethoscope } from "lucide-react";
import { Link } from "wouter";

interface StatsCardsProps {
  stats: {
    opdPatients: number;
    inpatients: number;
    labTests: number;
    diagnostics: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const statsData = [
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
      title: "In-patients",
      value: stats.inpatients.toString(),
      change: "Currently admitted",
      changeType: "neutral" as const,
      icon: Bed,
      bgColor: "bg-healthcare-green/10",
      iconColor: "text-healthcare-green",
      testId: "stat-inpatients",
      clickable: true,
      linkTo: "/admissions"
    },
    {
      title: "Lab Tests",
      value: stats.labTests.toString(),
      change: "Today",
      changeType: "positive" as const,
      icon: Microscope,
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-500",
      testId: "stat-labs",
      clickable: true,
      linkTo: "/lab-tests"
    },
    {
      title: "Diagnostics",
      value: stats.diagnostics.toString(),
      change: "Completed",
      changeType: "positive" as const,
      icon: Stethoscope,
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-500",
      testId: "stat-diagnostics",
      clickable: true,
      linkTo: "/pathology"
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
                    "text-medical-blue"
                  }`}>
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
