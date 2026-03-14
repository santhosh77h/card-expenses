"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Terminal,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Statement", icon: Upload },
  { href: "/statements", label: "All Statements", icon: FileText },
  { href: "/prompts", label: "Prompt Editor", icon: Terminal },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen flex flex-col border-r border-[#1E293B] bg-[#0A0E1A]/80 backdrop-blur-xl shrink-0 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-[#1E293B]">
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
            <div className="w-9 h-9 rounded-lg bg-[#00E5A0]/10 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-[#00E5A0]" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold tracking-wider text-white">
                  VECTOR
                </h1>
                <p className="text-[10px] tracking-[0.2em] text-[#64748B] uppercase">
                  Dashboard
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-[#00E5A0]/10 text-[#00E5A0] font-medium"
                  : "text-[#64748B] hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-[#1E293B]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 transition-colors text-sm"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-[#64748B] text-center">
            Vector v1.0 &middot; Your Money. Directed.
          </p>
        </div>
      )}
    </aside>
  );
}
