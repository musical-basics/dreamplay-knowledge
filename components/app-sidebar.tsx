"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Users,
    Target,
    ShieldCheck,
    Megaphone,
    BookOpen,
    Tags,
    Brain,
    ChevronDown,
} from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

const navSections = [
    {
        label: "Overview",
        items: [
            { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
        ],
    },
    {
        label: "AI Behavior",
        items: [
            { title: "Personas", href: "/admin/personas", icon: Users },
            { title: "Missions", href: "/admin/missions", icon: Target },
            { title: "Platform Rules", href: "/admin/rules", icon: ShieldCheck },
        ],
    },
    {
        label: "Brand Context",
        items: [
            { title: "Context Chunks", href: "/admin/context", icon: Megaphone },
        ],
    },
    {
        label: "Research",
        items: [
            { title: "Directory", href: "/admin/research", icon: BookOpen },
            { title: "Tags", href: "/admin/research-tags", icon: Tags },
        ],
    },
]

export function AppSidebar() {
    const pathname = usePathname()

    return (
        <Sidebar>
            <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
                <Link href="/admin" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                        <Brain className="h-4.5 w-4.5 text-[#D4AF37]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold tracking-tight">DreamPlay</h1>
                        <p className="text-[10px] text-muted-foreground -mt-0.5">Knowledge CMS</p>
                    </div>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                {navSections.map((section) => (
                    <Collapsible key={section.label} defaultOpen className="group/collapsible">
                        <SidebarGroup>
                            <SidebarGroupLabel asChild>
                                <CollapsibleTrigger className="flex w-full items-center justify-between">
                                    {section.label}
                                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-0 group-data-[state=closed]/collapsible:-rotate-90" />
                                </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {section.items.map((item) => {
                                            const isActive = pathname === item.href
                                            return (
                                                <SidebarMenuItem key={item.href}>
                                                    <SidebarMenuButton asChild isActive={isActive}>
                                                        <Link href={item.href}>
                                                            <item.icon className="h-4 w-4" />
                                                            <span>{item.title}</span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            )
                                        })}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </CollapsibleContent>
                        </SidebarGroup>
                    </Collapsible>
                ))}
            </SidebarContent>
        </Sidebar>
    )
}
