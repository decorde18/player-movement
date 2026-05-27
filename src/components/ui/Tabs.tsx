/**
 * Tabs Component - Uses Global Theme Variables
 * 
 * @example
 * // Default navigation tabs
 * <Tabs
 *   tabs={[
 *     { id: "registry", label: "Registry", icon: <Users size={16} /> },
 *     { id: "add", label: "Add Single", icon: <UserPlus size={16} /> }
 *   ]}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 * />
 * 
 * @example
 * // Solid / Block button tabs (often used for form toggles)
 * <Tabs
 *   variant="solid"
 *   tabs={[
 *     { id: "Boy", label: "Boy" },
 *     { id: "Girl", label: "Girl" },
 *     { id: "Coed", label: "Coed" }
 *   ]}
 *   activeTab={gender}
 *   onChange={setGender}
 * />
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  variant?: "default" | "solid";
  className?: string;
  tabClassName?: string;
}

export default function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = "default",
  className = "",
  tabClassName = "",
}: TabsProps<T>) {
  const isDefault = variant === "default";
  
  return (
    <div
      className={cn(
        "flex items-center",
        isDefault 
          ? "gap-2.5 bg-background p-1.5 rounded-xl border border-border self-start md:self-center"
          : "gap-2.5 w-full",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-2 font-bold transition-all duration-200 cursor-pointer border rounded-lg",
              isDefault
                ? "text-xs rounded-lg"
                : "flex-1 py-2 rounded-xl text-xs",
              isDefault
                ? isActive
                  ? "bg-surface text-primary shadow-sm border-border"
                  : "text-muted hover:text-text border-transparent"
                : isActive
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-surface border-border text-muted hover:text-text",
              tabClassName
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
