import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Stethoscope, 
  TestTube, 
  BedDouble, 
  FileText, 
  Shield, 
  Database, 
  BarChart3,
  Calendar,
  Building2,
  CheckCircle2,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Zap,
  Lock,
  Settings
} from "lucide-react";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  hospitalName: z.string().min(2, "Hospital name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const features = [
  {
    icon: Users,
    title: "Patient Management",
    description: "Complete patient registration, records, and history tracking",
  },
  {
    icon: Stethoscope,
    title: "Doctor Management",
    description: "Manage doctor profiles, schedules, and earnings",
  },
  {
    icon: Calendar,
    title: "OPD Management",
    description: "Streamline outpatient appointments and consultations",
  },
  {
    icon: TestTube,
    title: "Pathology Lab",
    description: "Order tests, track results, and generate reports",
  },
  {
    icon: BedDouble,
    title: "In-Patient Admissions",
    description: "Manage admissions, room transfers, and discharges",
  },
  {
    icon: FileText,
    title: "Billing & Payments",
    description: "Comprehensive billing with multiple payment methods",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Real-time insights and financial summaries",
  },
  {
    icon: Shield,
    title: "Audit Logs",
    description: "Complete activity tracking for compliance",
  },
  {
    icon: Database,
    title: "Backup & Restore",
    description: "Automated backups with one-click restore",
  },
];

const whyChoose = [
  {
    icon: Settings,
    title: "Fully Customizable",
    description: "Tailor every aspect to match your hospital's unique workflow",
  },
  {
    icon: Lock,
    title: "Owner-First Control",
    description: "Complete control over your data and system configuration",
  },
  {
    icon: Zap,
    title: "Advanced Features",
    description: "Role-based access, multi-user support, and real-time updates",
  },
  {
    icon: Sparkles,
    title: "Modern Interface",
    description: "Beautiful, intuitive design that your staff will love",
  },
];

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const { toast } = useToast();
  const heroRef = useRef(null);
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      hospitalName: "",
      phone: "",
      message: "",
    },
  });

  const onSubmit = (data: ContactFormData) => {
    console.log("Contact form submitted:", data);
    toast({
      title: "Request Submitted!",
      description: "We'll get back to you within 24 hours.",
    });
    form.reset();
  };

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section with Parallax */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Gradient Background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"
          style={{ y: y1 }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent"
          style={{ y: y2 }}
        />
        
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        
        <motion.div
          style={{ opacity }}
          className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-8"
          >
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-500">Next-Generation Hospital Management</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"
          >
            HMSync
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-6 text-foreground"
          >
            Advanced Control. Owner-First. Fully Customizable.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto"
          >
            The complete hospital management system designed for modern healthcare facilities. 
            Take control with advanced features, customizable workflows, and unparalleled flexibility.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              className="text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
              data-testid="button-request-demo"
            >
              Request a Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              data-testid="button-explore-features"
            >
              Explore Features
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-10 border-2 border-foreground/20 rounded-full flex items-start justify-center p-2"
          >
            <motion.div className="w-1 h-2 bg-foreground/40 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Hospital Management Simplified
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Stop struggling with outdated systems, fragmented workflows, and limited control. 
              HMSync brings everything together in one powerful, customizable platform.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <AnimatedSection>
              <Card className="p-8 h-full border-red-500/20 bg-red-500/5">
                <h3 className="text-2xl font-bold mb-4 text-red-600">Traditional Systems</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                    <span className="text-muted-foreground">Disconnected modules and data silos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                    <span className="text-muted-foreground">Limited customization options</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                    <span className="text-muted-foreground">No control over your own data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                    <span className="text-muted-foreground">Complex, outdated interfaces</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                    <span className="text-muted-foreground">Hidden costs and vendor lock-in</span>
                  </li>
                </ul>
              </Card>
            </AnimatedSection>

            <AnimatedSection>
              <Card className="p-8 h-full border-green-500/20 bg-green-500/5">
                <h3 className="text-2xl font-bold mb-4 text-green-600">HMSync Approach</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    <span className="text-muted-foreground">Fully integrated, unified platform</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    <span className="text-muted-foreground">Customize every workflow to your needs</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    <span className="text-muted-foreground">Complete ownership and control</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    <span className="text-muted-foreground">Modern, intuitive user experience</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    <span className="text-muted-foreground">Transparent pricing, no surprises</span>
                  </li>
                </ul>
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Everything You Need, All in One Place
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Comprehensive features designed for complete hospital management
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <AnimatedSection key={index}>
                <motion.div
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card className="p-6 h-full hover:shadow-xl transition-shadow" data-testid={`card-feature-${index}`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </Card>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose HMSync */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Parallax Background */}
        <motion.div
          style={{ y: y1 }}
          className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"
        />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Why Choose HMSync?
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Built with your hospital's unique needs in mind
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8">
            {whyChoose.map((item, index) => (
              <AnimatedSection key={index}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card className="p-8 h-full bg-card/50 backdrop-blur">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="mt-16 text-center">
            <Card className="p-8 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
              <h3 className="text-2xl font-bold mb-4">No Fixed Pricing. No Hidden Costs.</h3>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Every hospital is different. That's why we create custom solutions tailored to your size, 
                specialty, and workflow. Contact us for a personalized quote.
              </p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
                data-testid="button-get-quote"
              >
                Get Your Custom Quote
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Request a Demo
            </h2>
            <p className="text-lg text-muted-foreground">
              See HMSync in action. We'll reach out within 24 hours to schedule your personalized demo.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <Card className="p-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Your Name *</label>
                    <Input
                      {...form.register("name")}
                      placeholder="Dr. John Smith"
                      className="w-full"
                      data-testid="input-name"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address *</label>
                    <Input
                      {...form.register("email")}
                      type="email"
                      placeholder="john@hospital.com"
                      className="w-full"
                      data-testid="input-email"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Hospital Name *</label>
                    <Input
                      {...form.register("hospitalName")}
                      placeholder="City General Hospital"
                      className="w-full"
                      data-testid="input-hospital"
                    />
                    {form.formState.errors.hospitalName && (
                      <p className="text-sm text-red-500 mt-1">{form.formState.errors.hospitalName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone Number *</label>
                    <Input
                      {...form.register("phone")}
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      className="w-full"
                      data-testid="input-phone"
                    />
                    {form.formState.errors.phone && (
                      <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message *</label>
                  <Textarea
                    {...form.register("message")}
                    placeholder="Tell us about your hospital and what you're looking for..."
                    className="w-full min-h-[120px]"
                    data-testid="input-message"
                  />
                  {form.formState.errors.message && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.message.message}</p>
                  )}
                </div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    data-testid="button-submit-contact"
                  >
                    Send Request
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </form>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                HMSync
              </h3>
              <p className="text-muted-foreground mb-4">
                Advanced Control. Owner-First. Fully Customizable.
              </p>
              <p className="text-sm text-muted-foreground">
                The complete hospital management system for modern healthcare.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">contact@hmsync.com</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">+1 (555) 000-0000</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Available Worldwide</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2">
                <button
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-features"
                >
                  Features
                </button>
                <button
                  onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-contact"
                >
                  Contact Sales
                </button>
              </div>
            </div>
          </div>

          <div className="border-t pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} HMSync. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
