/**
 * Optimized UI Component Exports
 *
 * This file provides optimized exports for UI components to improve bundle size
 * and loading performance. Components are lazy-loaded where appropriate.
 */

// Core UI components - frequently used, keep as regular imports
export { Avatar, AvatarFallback, AvatarImage } from "./avatar";
export { Badge } from "./badge";
export { Button } from "./button";
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
// Dialog components
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
// Dropdown components
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
export { Input } from "./input";
export { Label } from "./label";
// Progress components
export { Progress } from "./progress";
// ScrollArea component
export { ScrollArea } from "./scroll-area";
// Select components
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
// Separator component
export { Separator } from "./separator";
// Sheet components (for mobile)
export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
// Sidebar components - used in layout
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";
// Skeleton component
export { Skeleton } from "./skeleton";
// Switch component
export { Switch } from "./switch";
// Table components
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
// Tabs components
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./tabs";
// Tooltip components
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
// Toast components
export { toast } from "./use-toast";
