"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

interface DrawerProps extends Dialog.DialogProps {
  direction?: string;
}

export const Drawer: React.FC<DrawerProps> = ({ children, ...props }) => {
  return <Dialog.Root {...props}>{children}</Dialog.Root>;
};
export const DrawerTrigger = Dialog.Trigger;
export const DrawerClose = Dialog.Close;
export const DrawerTitle = Dialog.Title;
export const DrawerDescription = Dialog.Description;

export function DrawerContent({ className, ...props }: Dialog.DialogContentProps) {
  return <Dialog.Content className={cn("z-50 bg-background p-4", className)} {...props} />;
}

export function DrawerHeader(props: React.ComponentProps<typeof Dialog.Title>) {
  return <div {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-end gap-2", className)} {...props} />;
}
