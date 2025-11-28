import { Card, CardContent } from "@/components/ui/card";
import { Users, BedSingle, Microscope, ClipboardPlus } from "lucide-react";
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
  console.log("[StatsCards] Received stats:", stats);
  const statsData = [
    {
      title: "OPD Appointments",
      value: stats.opdPatients.toString(),
      change: "Today",
      changeType: "neutral" as const,
      icon: Users,
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-700",
      titleColor: "text-blue-700",
      valueColor: "text-blue-700",
      changeColor: "text-blue-700",
      testId: "stat-opd",
      clickable: true,
      linkTo: "/opd-list",
    },
    {
      title: "In-patients",
      value: stats.inpatients.toString(),
      change: "Currently admitted",
      changeType: "neutral" as const,
      icon: BedSingle,
      bgColor: "bg-green-500/10",
      iconColor: "text-green-700",
      titleColor: "text-green-700",
      valueColor: "text-green-700",
      changeColor: "text-green-700",
      testId: "stat-inpatients",
      clickable: true,
      linkTo: "/admissions",
    },
    {
      title: "Lab Tests",
      value: stats.labTests.toString(),
      change: "Today",
      changeType: "positive" as const,
      icon: Microscope,
      bgColor: "bg-pink-500/10",
      iconColor: "text-pink-700",
      titleColor: "text-pink-700",
      valueColor: "text-pink-700",
      changeColor: "text-pink-700",
      testId: "stat-labs",
      clickable: true,
      linkTo: "/lab-tests",
    },
    {
      title: "Diagnostics",
      value: stats.diagnostics.toString(),
      change: "Completed",
      changeType: "positive" as const,
      icon: ClipboardPlus,
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-700",
      titleColor: "text-purple-700",
      valueColor: "text-purple-700",
      changeColor: "text-purple-700",
      testId: "stat-diagnostics",
      clickable: true,
      linkTo: "/diagnostics",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat) => {
        const CardWrapper = (stat as any).clickable
          ? ({ children, ...props }: any) => (
              <Link href={(stat as any).linkTo}>
                <Card
                  {...props}
                  className={`shadow-sm cursor-pointer hover:shadow-md transition-shadow ${props.className || ""}`}
                >
                  {children}
                </Card>
              </Link>
            )
          : ({ children, ...props }: any) => <Card {...props}>{children}</Card>;

        return (
          <CardWrapper key={stat.title} data-testid={stat.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${(stat as any).titleColor}`}>
                    {stat.title}
                  </p>
                  <p
                    className={`text-2xl font-bold mt-1 ${(stat as any).valueColor}`}
                    data-testid={`${stat.testId}-value`}
                  >
                    {stat.value}
                  </p>
                  <p
                    className={`text-sm font-medium mt-2 ${(stat as any).changeColor}`}
                  >
                    {stat.change}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                >
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
