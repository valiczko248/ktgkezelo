"use client";

import {
  ShoppingCart, Utensils, Car, Home, Zap, HeartPulse, Popcorn, Shirt,
  Plane, GraduationCap, Repeat, MoreHorizontal, Banknote, Briefcase,
  Gift, PlusCircle, Wallet, Tag, CreditCard, PiggyBank, Landmark,
  Coins, ArrowLeftRight, Calendar, BarChart3, Settings, LayoutGrid,
  Plus, X, Check, Pencil, Trash2, ChevronLeft, ChevronRight, Sun, Moon,
  LogOut, StickyNote, TrendingUp, TrendingDown, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  "utensils": Utensils,
  "car": Car,
  "home": Home,
  "zap": Zap,
  "heart-pulse": HeartPulse,
  "popcorn": Popcorn,
  "shirt": Shirt,
  "plane": Plane,
  "graduation-cap": GraduationCap,
  "repeat": Repeat,
  "more-horizontal": MoreHorizontal,
  "banknote": Banknote,
  "briefcase": Briefcase,
  "gift": Gift,
  "plus-circle": PlusCircle,
  "wallet": Wallet,
  "tag": Tag,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  "landmark": Landmark,
  "coins": Coins,
  "arrow-left-right": ArrowLeftRight,
  "calendar": Calendar,
  "bar-chart": BarChart3,
  "settings": Settings,
  "grid": LayoutGrid,
  "note": StickyNote,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
};

export { Plus, X, Check, Pencil, Trash2, ChevronLeft, ChevronRight, Sun, Moon, LogOut };

export function Icon({
  name,
  className,
  strokeWidth = 2,
  style,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const Cmp = ICONS[name] || Tag;
  return <Cmp className={className} strokeWidth={strokeWidth} style={style} />;
}

export const ICON_NAMES = Object.keys(ICONS);
