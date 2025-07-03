"use client";

import { Menu, X } from "lucide-react";
import React, { ReactNode, useCallback, useEffect } from "react";
import { useIsMobile } from "../../hooks/use-mobile-clean";
import { cn } from "../../lib/utils";

export interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export interface MobileSidebarTriggerProps {
  open: boolean;
  onClick: () => void;
  className?: string;
}

export interface MobileSidebarContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * Mobile Sidebar Component
 * Touch-optimized sidebar with accessibility features
 */
export function MobileSidebar({ open, onOpenChange, children, className }: MobileSidebarProps) {
  const { isMobile } = useIsMobile();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  // Handle body scroll prevention
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Sidebar */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-72 bg-white shadow-xl",
          "transform transition-transform duration-300 ease-in-out",
          "touch-manipulation overscroll-contain",
          "border-r border-gray-200",
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close sidebar"
          className={cn(
            "absolute right-4 top-4 z-10",
            "flex h-8 w-8 items-center justify-center",
            "rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200",
            "touch-manipulation"
          )}
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="h-full overflow-hidden pt-16">{children}</div>
      </div>
    </>
  );
}

/**
 * Mobile Sidebar Trigger Button
 * Touch-optimized trigger with proper accessibility
 */
export function MobileSidebarTrigger({ open, onClick, className }: MobileSidebarTriggerProps) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={open}
      className={cn(
        "flex h-11 w-11 items-center justify-center", // 44px touch target
        "rounded-md bg-transparent text-gray-700 hover:bg-gray-100",
        "touch-manipulation transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        className
      )}
    >
      {open ? (
        <X size={20} data-testid="close-icon" />
      ) : (
        <Menu size={20} data-testid="hamburger-icon" />
      )}
    </button>
  );
}

/**
 * Mobile Sidebar Content Wrapper
 * Mobile-optimized content container
 */
export function MobileSidebarContent({
  children,
  className,
  ...props
}: MobileSidebarContentProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex h-full w-full flex-col overflow-hidden", "px-4 py-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}
