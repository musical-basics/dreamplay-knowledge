import { Brain, Users, Target, BookOpen, Megaphone, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

const quickLinks = [
    { title: "Personas", description: "Manage AI voice & tone profiles", href: "/admin/personas", icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
    { title: "Missions", description: "Define generation goals & strategies", href: "/admin/missions", icon: Target, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Platform Rules", description: "Set strict HTML/format constraints", href: "/admin/rules", icon: ShieldCheck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Context Chunks", description: "Toggle marketing context on/off", href: "/admin/context", icon: Megaphone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Research Directory", description: "Browse & manage research papers", href: "/admin/research", icon: BookOpen, color: "text-rose-500", bg: "bg-rose-500/10" },
]

export default function DashboardPage() {
    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                        <Brain className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Knowledge Dashboard</h1>
                </div>
                <p className="text-muted-foreground">
                    Centralized AI brain for DreamPlay. Manage personas, missions, rules, and research.
                </p>
            </div>

            {/* Quick Links Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quickLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                        <Card className="bg-card border-border hover:border-[#D4AF37]/30 transition-colors cursor-pointer h-full">
                            <CardContent className="flex items-start gap-4 p-5">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${link.bg}`}>
                                    <link.icon className={`h-5 w-5 ${link.color}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{link.title}</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{link.description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Placeholder for Phase 3 Dashboard widgets */}
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    Token estimator, top-cited research, and active context overview will appear here after Phase 3.
                </p>
            </div>
        </div>
    )
}
