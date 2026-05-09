"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, MapPin, ShieldCheck, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Sidebar({ role }: { role: string | null }) {
  const pathname = usePathname();
  const nav = [
    { href: "/dashboard",           label: "Overview",   icon: LayoutDashboard, show: true },
    { href: "/dashboard/locations", label: "Locations",  icon: MapPin,          show: true },
    { href: "/dashboard/stats",     label: "Statistics", icon: BarChart2,       show: true },
    { href: "/dashboard/admin",     label: "Admin",      icon: ShieldCheck,     show: role === "admin" },
  ];

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-white">🦃 TurkeyLab</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
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
        <UserButton afterSignOutUrl="/sign-in" />
        <span className="text-xs text-gray-500 capitalize">{role ?? "viewer"}</span>
      </div>
    </aside>
  );
}
