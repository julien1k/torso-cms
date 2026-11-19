"use client"

import { Tabs as TabsRoot, TabsIndicator, TabsList as TabsListPrimitive, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

type WithClass<T> = Omit<T, "className" | "children"> & { className?: string; children?: ReactNode }

function Tabs({ className, ...props }: WithClass<ComponentProps<typeof TabsRoot>>) {
  return <TabsRoot className={cn("flex flex-col gap-3", className)} {...props} />
}

function TabsList({ className, children, ...props }: WithClass<ComponentProps<typeof TabsListPrimitive>>) {
  return (
    <TabsListPrimitive
      className={cn(
        "relative isolate inline-flex h-9 w-full max-w-full items-center sm:w-fit overflow-x-auto rounded-none bg-muted p-1 text-muted-foreground [scrollbar-width:none]",
        className,
      )}
      {...props}
    >
      {/* The marker slides to the selected tab instead of jumping. */}
      <TabsIndicator className="absolute top-1 bottom-1 left-0 -z-10 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-none bg-background shadow-sm transition-[translate,width] duration-200 ease-(--ease-out) motion-reduce:transition-none" />
      {children}
    </TabsListPrimitive>
  )
}

function TabsTrigger({ className, ...props }: WithClass<ComponentProps<typeof TabsTab>>) {
  return (
    <TabsTab
      className={cn(
        "h-full flex-1 justify-center rounded-none px-2 text-sm sm:flex-none sm:px-3 font-medium whitespace-nowrap outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-selected:text-foreground data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: WithClass<ComponentProps<typeof TabsPanel>>) {
  return <TabsPanel className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
