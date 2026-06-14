"use client"

import { Palette, Type, User, Wallet, Store, Users, Tags } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { ProfileSection } from "@/components/settings/profile-section"
import { ThemeSettings } from "@/components/settings/theme-section"
import { AppearanceSettings } from "@/components/settings/appearance-section"
import { TokoSettings } from "@/components/settings/toko-section"
import { StaffSettings } from "@/components/settings/staff-section"
import { PriceTierSettings } from "@/components/settings/price-tier-section"
import { QrisSettings } from "@/components/qris/qris-settings"
import { BankSettings } from "@/components/bank/bank-settings"

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Pengaturan" />

      <Accordion className="space-y-2 sm:space-y-3">
        <AccordionItem value="profile">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <User className="size-4" />
              Profil
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <ProfileSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="toko">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Store className="size-4" />
              Toko
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <TokoSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="staff">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Users className="size-4" />
              Staff
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <StaffSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="theme">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Palette className="size-4" />
              Tema
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <ThemeSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="appearance">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Type className="size-4" />
              Tampilan
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <AppearanceSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pricing">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Tags className="size-4" />
              Harga
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <PriceTierSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="payment">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Wallet className="size-4" />
              Pembayaran
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <QrisSettings />
            <BankSettings />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}
