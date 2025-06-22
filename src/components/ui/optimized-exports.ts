/**
 * Optimized UI Component Exports
 *
 * This file provides optimized exports for UI components to improve bundle size
 * and loading performance. Components are lazy-loaded where appropriate.
 */

// Core UI components - frequently used, keep as regular imports
export { Avatar, AvatarFallback, AvatarImage } from "./avatar";
export { Button } from "./button";
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
export { Input } from "./input";
export { Label } from "./label";
export { Badge } from "./badge";

// Dropdown components
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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

// Dialog components
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

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

// Toast components
export { toast } from "./use-toast";

// Select components
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

// Progress components
export { Progress } from "./progress";

// Tabs components
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./tabs";

// Sheet components (for mobile)
export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

// Tooltip components
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// Switch component
export { Switch } from "./switch";

// Separator component
export { Separator } from "./separator";

// ScrollArea component
export { ScrollArea } from "./scroll-area";

// Skeleton component
export { Skeleton } from "./skeleton";
