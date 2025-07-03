"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

interface StatusProviderWrapperProps {
  children: ReactNode;
}

interface StatusContextType {
  status: string;
  updateStatus: (status: string) => void;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export function StatusProviderWrapper({ children }: StatusProviderWrapperProps) {
  const [status, setStatus] = useState("ready");

  const updateStatus = (newStatus: string) => {
    setStatus(newStatus);
  };

  return (
    <StatusContext.Provider value={{ status, updateStatus }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatusProvider() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatusProvider must be used within StatusProviderWrapper");
  }
  return context;
}