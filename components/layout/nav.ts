import {
  Archive,
  ClipboardList,
  Factory,
  Home,
  LayoutDashboard,
  Monitor,
  Plus,
  ReceiptText,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  description?: string
}

export const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
    description: "Overview toko dan ringkasan harian",
  },
  {
    label: "Kasir",
    href: "/cashier",
    icon: Monitor,
    description: "Catat penjualan pempek",
  },
  {
    label: "Pesanan",
    href: "/pesanan",
    icon: ClipboardList,
    description: "Kelola pesanan pelanggan",
  },
  {
    label: "Produksi",
    href: "/production",
    icon: Factory,
    description: "Bahan keluar, produk masuk",
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Archive,
    description: "Riwayat pergerakan stok",
  },
  {
    label: "Laporan",
    href: "/reports",
    icon: LayoutDashboard,
    description: "Penjualan, produksi, dan belanja",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Pengaturan toko dan preferensi",
  },
]

export const bottomNavItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Kasir", href: "/cashier", icon: Monitor },
  { label: "Tambah", href: "/inventory", icon: Plus },
  { label: "Produksi", href: "/production", icon: Factory },
  { label: "Inventory", href: "/inventory", icon: ReceiptText },
]
