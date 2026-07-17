"use client"

import * as React from "react"
import { isNativeApp, useBtPrint, type BtPreparedState, type BtPrinterDevice, type BtPrintState } from "@/components/printer"
import type { EscPosReceipt } from "@/lib/escpos-print"

type PrinterContextValue = {
  printState: BtPrintState
  preparedState: BtPreparedState
  prepareBluetoothPrinter: () => Promise<boolean>
  printPreparedOrBluetooth: (receipt: EscPosReceipt) => Promise<void>
  printViaBluetooth: (receipt: EscPosReceipt) => Promise<void>
  listBluetoothPrinters: () => Promise<BtPrinterDevice[]>
  connectBluetoothPrinter: (printer: BtPrinterDevice) => Promise<boolean>
  selectAndPrint: (address: string, receipt: EscPosReceipt) => Promise<void>
  reset: () => void
  disconnectPreparedPrinter: () => Promise<void>
  forgetBluetoothPrinter: () => Promise<void>
}

const PrinterContext = React.createContext<PrinterContextValue | null>(null)

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const printer = useBtPrint()
  const { disconnectPreparedPrinter } = printer

  React.useEffect(() => {
    if (!isNativeApp()) return

    return () => {
      void disconnectPreparedPrinter()
    }
  }, [disconnectPreparedPrinter])

  return (
    <PrinterContext.Provider value={printer}>
      {children}
    </PrinterContext.Provider>
  )
}

export function usePrinter() {
  const context = React.useContext(PrinterContext)

  if (!context) {
    throw new Error("usePrinter must be used within PrinterProvider")
  }

  return context
}
