/* eslint-disable react-refresh/only-export-components -- icon component +
   shared icon/color data are intentionally colocated. */
import {
  Utensils,
  ShoppingCart,
  Home,
  Car,
  Film,
  Heart,
  BookOpen,
  Briefcase,
  Gift,
  Coffee,
  Zap,
  Smartphone,
  Wallet,
  ShoppingBag,
  Plane,
  Dumbbell,
  PawPrint,
  Shirt,
  Music,
  Wrench,
  CircleDollarSign,
} from "lucide-react";

// Category "icon" values map to lucide icons.
export const ICON_OPTIONS = [
  { name: "utensils", icon: Utensils, label: "Food & Dining" },
  { name: "shopping-cart", icon: ShoppingCart, label: "Groceries" },
  { name: "home", icon: Home, label: "Home & Rent" },
  { name: "car", icon: Car, label: "Transportation" },
  { name: "film", icon: Film, label: "Entertainment" },
  { name: "heart", icon: Heart, label: "Health & Wellness" },
  { name: "book", icon: BookOpen, label: "Education" },
  { name: "briefcase", icon: Briefcase, label: "Work & Business" },
  { name: "gift", icon: Gift, label: "Gifts & Donations" },
  { name: "coffee", icon: Coffee, label: "Coffee & Snacks" },
  { name: "zap", icon: Zap, label: "Utilities & Bills" },
  { name: "smartphone", icon: Smartphone, label: "Phone & Tech" },
  { name: "wallet", icon: Wallet, label: "Personal Finance" },
  { name: "shopping-bag", icon: ShoppingBag, label: "Shopping" },
  { name: "plane", icon: Plane, label: "Travel" },
  { name: "dumbbell", icon: Dumbbell, label: "Sports & Fitness" },
  { name: "paw-print", icon: PawPrint, label: "Pets" },
  { name: "shirt", icon: Shirt, label: "Clothing" },
  { name: "music", icon: Music, label: "Music & Subscriptions" },
  { name: "wrench", icon: Wrench, label: "Repairs & Maintenance" },
];

const ICON_MAP = Object.fromEntries(
  ICON_OPTIONS.map(({ name, icon }) => [name, icon]),
);

export const ICON_LABEL_MAP = Object.fromEntries(
  ICON_OPTIONS.map(({ name, label }) => [name, label]),
);

export function CategoryIcon({ name, size = 18, ...props }) {
  const Icon = ICON_MAP[name] || CircleDollarSign;
  return <Icon size={size} {...props} />;
}

export const COLOR_OPTIONS = [
  "#1e9e50",
  "#2ebd59",
  "#f0b429",
  "#e8a33d",
  "#d99a26",
  "#e2483d",
  "#f2554c",
  "#f97316",
  "#0ea5e9",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
];

// Deterministic fallback palette when a category has no stored color.
export const FALLBACK_COLORS = [
  "#1e9e50",
  "#2ebd59",
  "#f0b429",
  "#d99a26",
  "#e2483d",
  "#f2554c",
  "#0ea5e9",
  "#8b5cf6",
];

export const colorFor = (name, index = 0) =>
  FALLBACK_COLORS[Math.abs(String(name).length + index) % FALLBACK_COLORS.length];
