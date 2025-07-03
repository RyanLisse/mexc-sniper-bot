"use client";

import { ChevronDown, ChevronUp, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, memo, useCallback, useState } from "react";
import { useAuth } from "./auth/supabase-auth-provider";
import { Badge } from "./ui/badge";

interface UserMenuProps {
  user: {
    id: string;
    email: string;
    name?: string;
    username?: string;
  };
}

export const UserMenu = memo(function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setIsOpen(false);
    await signOut();
  }, [signOut]);

  const handleToggleOpen = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  const handleSettingsClick = useCallback(() => {
    setIsOpen(false);
    router.push("/config");
  }, [router]);

  const displayName = user.name || user.username || user.email;
  const displayEmail = user.email;

  return (
    <div className="relative">
      {/* User Badge - Clickable */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className="flex items-center space-x-2 hover:bg-slate-700/50 px-3 py-2 rounded-lg transition-colors"
      >
        <Badge variant="secondary" className="bg-green-900 text-green-300 cursor-pointer">
          <User className="h-3 w-3 mr-1" />
          {displayName}
        </Badge>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={handleClose}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Close dropdown"
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-slate-400 truncate">{displayEmail}</p>
                  {user.username && (
                    <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {/* Profile/Settings Link */}
              <button
                type="button"
                onClick={handleSettingsClick}
                className="w-full flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Settings className="h-4 w-4 mr-3" />
                Account Settings
              </button>

              {/* Divider */}
              <div className="border-t border-slate-700 my-2" />

              {/* Sign Out */}
              <button
                type="button"
                className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut className="h-4 w-4 mr-3" />
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
