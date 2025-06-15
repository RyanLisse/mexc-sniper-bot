/**
 * Optimized UI Component Exports
 * Tree-shakeable exports to reduce bundle size
 * Part of Task 5.1: Bundle Size Optimization
 */

// Core UI Components - Only export what's needed
export { Button } from "./button";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
export { Input } from "./input";
export { Label } from "./label";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
export { Badge } from "./badge";
export { Progress } from "./progress";
export { Switch } from "./switch";
export { Checkbox } from "./checkbox";

// Avatar components
export { Avatar, AvatarFallback, AvatarImage } from "./avatar";

// Navigation components
export { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "./dropdown-menu";

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

// Table components
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

// Tooltip components
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

// Sheet/Drawer components  
export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

// Alert components
export { Alert, AlertDescription, AlertTitle } from "./alert";

// Scroll area
export { ScrollArea } from "./scroll-area";

// Toggle components
export { Toggle } from "./toggle";
export { ToggleGroup, ToggleGroupItem } from "./toggle-group";

// Separator
export { Separator } from "./separator";

// Chart components (for dashboard)
export { ChartContainer, ChartTooltip, ChartTooltipContent } from "./chart";

// Calendar component
export { Calendar } from "./calendar";

// Skeleton component
export { Skeleton } from "./skeleton";

// Toast hook
export { useToast } from "./use-toast";