"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, MapPin, ShieldCheck, BarChart2, Thermometer, Wheat, LayoutGrid, CalendarClock, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import TurkeySearch from "@/components/TurkeySearch";

export default function Sidebar({ role }: { role: string | null }) {
  const pathname = usePathname();
  const nav = [
    { href: "/dashboard",           label: t.nav.overview,  icon: LayoutDashboard, show: true },
    { href: "/dashboard/locations", label: t.nav.locations, icon: MapPin,          show: true },
    { href: "/dashboard/barn",      label: t.barn.navLabel,  icon: LayoutGrid,    show: true },
    { href: "/dashboard/daily",     label: t.daily.navLabel, icon: Thermometer,   show: true },
    { href: "/dashboard/feed",      label: t.feed.navLabel,  icon: Wheat,         show: true },
    { href: "/dashboard/tasks",     label: t.tasksEditor.navLabel, icon: CalendarClock, show: true },
    { href: "/dashboard/ethogram",  label: "Ethogram",       icon: Mic,           show: true },
    { href: "/dashboard/stats",     label: t.nav.stats,      icon: BarChart2,     show: true },
    { href: "/dashboard/admin",     label: t.nav.admin,     icon: ShieldCheck,     show: role === "admin" },
  ];

  const roleLabel = role
    ? (t.role as Record<string, string>)[role] ?? role
    : t.role.viewer;

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-white">{t.brand}</span>
      </div>
      <div className="pt-4">
        <TurkeySearch />
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1">
        {nav.filter(n => n.show).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                ? "bg-emerald-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-3">
        <UserButton />
        <span className="text-xs text-gray-500">{roleLabel}</span>
      </div>
    </aside>
  );
}
