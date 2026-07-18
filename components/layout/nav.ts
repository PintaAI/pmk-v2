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
    label: "Beranda",
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
    label: "Produk & Produksi",
    href: "/production",
    icon: Factory,
    description: "Bahan keluar, produk masuk",
  },
  {
    label: "Bahan & Belanja",
    href: "/inventory",
    icon: Archive,
    description: "Kelola bahan baku, stok, dan pembelian",
  },
  {
    label: "Laporan",
    href: "/reports",
    icon: LayoutDashboard,
    description: "Penjualan, produksi, dan belanja",
  },
  {
    label: "Pengaturan",
    href: "/settings",
    icon: Settings,
    description: "Pengaturan toko dan preferensi",
  },
]

export const bottomNavItems: NavItem[] = [
  { label: "Beranda", href: "/", icon: Home },
  { label: "Kasir", href: "/cashier", icon: Monitor },
  { label: "Aksi", href: "/inventory", icon: Plus },
  { label: "Pesanan", href: "/pesanan", icon: ClipboardList },
  { label: "Bahan", href: "/inventory", icon: ReceiptText },
]
