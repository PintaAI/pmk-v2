"use client"

import { useCallback, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { BluetoothSerial } from "@ascentio-it/capacitor-bluetooth-serial"
import { buildEscPosBytes, bytesToBtString, type EscPosReceipt } from "@/lib/escpos-print"

type BtPrinterDevice = { name: string; address: string }

const SAVED_PRINTER_KEY = "pmk.btPrinter"

export type BtPrintState =
  | { phase: "idle" }
  | { phase: "checking_permissions" }
  | { phase: "enabling" }
  | { phase: "scanning" }
  | { phase: "select_device"; devices: BtPrinterDevice[] }
  | { phase: "connecting"; deviceName: string }
  | { phase: "printing" }
  | { phase: "done" }
  | { phase: "error"; message: string }

export type BtPreparedState =
  | { phase: "idle" }
  | { phase: "preparing"; deviceName: string }
  | { phase: "ready"; deviceName: string }
  | { phase: "failed" }

export function useBtPrint() {
  const [state, setState] = useState<BtPrintState>({ phase: "idle" })
  const [preparedState, setPreparedState] = useState<BtPreparedState>({ phase: "idle" })
  const preparedPrinterRef = useRef<BtPrinterDevice | null>(null)
  const preparePromiseRef = useRef<Promise<boolean> | null>(null)
  const prepareTokenRef = useRef(0)

  const reset = useCallback(() => setState({ phase: "idle" }), [])

  const getSavedPrinter = useCallback((): BtPrinterDevice | null => {
    try {
      const raw = window.localStorage.getItem(SAVED_PRINTER_KEY)
      if (!raw) return null
      const printer = JSON.parse(raw) as Partial<BtPrinterDevice>
      if (typeof printer.name === "string" && typeof printer.address === "string") {
        return { name: printer.name, address: printer.address }
      }
    } catch {
      window.localStorage.removeItem(SAVED_PRINTER_KEY)
    }

    return null
  }, [])

  const savePrinter = useCallback((printer: BtPrinterDevice) => {
    window.localStorage.setItem(SAVED_PRINTER_KEY, JSON.stringify(printer))
  }, [])

  const forgetSavedPrinter = useCallback(() => {
    window.localStorage.removeItem(SAVED_PRINTER_KEY)
  }, [])

  const writeReceipt = useCallback(async (address: string, receipt: EscPosReceipt) => {
    const escpos = await buildEscPosBytes(receipt)
    const btString = bytesToBtString(escpos)

    await BluetoothSerial.write({ address, value: btString })
    await new Promise((r) => setTimeout(r, 500))
  }, [])

  const disconnectPreparedPrinter = useCallback(async () => {
    prepareTokenRef.current += 1
    preparePromiseRef.current = null
    const printer = preparedPrinterRef.current
    preparedPrinterRef.current = null
    setPreparedState({ phase: "idle" })

    if (printer) {
      await BluetoothSerial.disconnect({ address: printer.address }).catch(() => {})
    }
  }, [])

  const prepareBluetoothPrinter = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return false
    if (preparedPrinterRef.current) return true
    if (preparePromiseRef.current) return preparePromiseRef.current

    const savedPrinter = getSavedPrinter()
    if (!savedPrinter) return false

    const token = prepareTokenRef.current + 1
    prepareTokenRef.current = token
    setPreparedState({ phase: "preparing", deviceName: savedPrinter.name })

    const promise = (async () => {
      try {
        const permGranted = await BluetoothSerial.checkBluetoothPermissions()
        if (!permGranted) throw new Error("Bluetooth permission not granted")

        const btState = await BluetoothSerial.isEnabled()
        if (!btState.enabled) throw new Error("Bluetooth is disabled")

        await BluetoothSerial.connect({ address: savedPrinter.address })

        if (prepareTokenRef.current !== token) {
          await BluetoothSerial.disconnect({ address: savedPrinter.address }).catch(() => {})
          return false
        }

        preparedPrinterRef.current = savedPrinter
        setPreparedState({ phase: "ready", deviceName: savedPrinter.name })
        return true
      } catch {
        if (prepareTokenRef.current === token) {
          preparedPrinterRef.current = null
          preparePromiseRef.current = null
          forgetSavedPrinter()
          setPreparedState({ phase: "failed" })
        }

        return false
      } finally {
        if (prepareTokenRef.current === token) {
          preparePromiseRef.current = null
        }
      }
    })()

    preparePromiseRef.current = promise
    return promise
  }, [forgetSavedPrinter, getSavedPrinter])

  const connectAndPrint = useCallback(
    async (deviceName: string, address: string, receipt: EscPosReceipt) => {
      setState({ phase: "connecting", deviceName })

      let connected = false

      try {
        await BluetoothSerial.connect({ address })
        connected = true

        setState({ phase: "printing" })

        await writeReceipt(address, receipt)
      } finally {
        if (connected) {
          await BluetoothSerial.disconnect({ address }).catch(() => {})
        }
      }

      setState({ phase: "done" })
    },
    [writeReceipt],
  )

  const printViaBluetooth = useCallback(
    async (receipt: EscPosReceipt) => {
      if (!Capacitor.isNativePlatform()) return

      try {
        setState({ phase: "checking_permissions" })

        const permGranted = await BluetoothSerial.checkBluetoothPermissions()
        if (!permGranted) {
          setState({
            phase: "error",
            message: "Izin Bluetooth tidak diberikan. Buka pengaturan untuk mengizinkan.",
          })
          return
        }

        const btState = await BluetoothSerial.isEnabled()
        if (!btState.enabled) {
          setState({ phase: "enabling" })
          const canEnable = await BluetoothSerial.canEnable()
          if (canEnable.enabled) {
            await BluetoothSerial.enable()
          } else {
            setState({
              phase: "error",
              message: "Bluetooth tidak dapat diaktifkan. Silakan aktifkan secara manual.",
            })
            return
          }
        }

        const savedPrinter = getSavedPrinter()
        if (savedPrinter) {
          try {
            await connectAndPrint(savedPrinter.name, savedPrinter.address, receipt)
            return
          } catch {
            forgetSavedPrinter()
          }
        }

        setState({ phase: "scanning" })

        const paired = await BluetoothSerial.getPairedDevices()

        if (paired.devices.length === 0) {
          setState({
            phase: "error",
            message:
              "Tidak ditemukan printer yang dipasangkan. Pasangkan dulu MP-58N melalui pengaturan Android.",
          })
          return
        }

        const printer = paired.devices.find((d) => {
          const name = d.name.toUpperCase()
          return name.includes("MP-58") || name.includes("MP58")
        })

        if (!printer) {
          setState({
            phase: "select_device",
            devices: paired.devices,
          })
          return
        }

        savePrinter(printer)
        await connectAndPrint(printer.name, printer.address, receipt)
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Gagal mencetak",
        })
      }
    },
    [connectAndPrint, forgetSavedPrinter, getSavedPrinter, savePrinter],
  )

  const printPreparedOrBluetooth = useCallback(
    async (receipt: EscPosReceipt) => {
      if (!Capacitor.isNativePlatform()) return

      if (preparePromiseRef.current) {
        await preparePromiseRef.current
      }

      const preparedPrinter = preparedPrinterRef.current
      if (!preparedPrinter) {
        await printViaBluetooth(receipt)
        return
      }

      try {
        setState({ phase: "printing" })
        await writeReceipt(preparedPrinter.address, receipt)
        preparedPrinterRef.current = null
        setPreparedState({ phase: "idle" })
        await BluetoothSerial.disconnect({ address: preparedPrinter.address }).catch(() => {})
        setState({ phase: "done" })
      } catch {
        preparedPrinterRef.current = null
        setPreparedState({ phase: "failed" })
        forgetSavedPrinter()
        await BluetoothSerial.disconnect({ address: preparedPrinter.address }).catch(() => {})
        await printViaBluetooth(receipt)
      }
    },
    [forgetSavedPrinter, printViaBluetooth, writeReceipt],
  )

  const selectAndPrint = useCallback(
    async (address: string, receipt: EscPosReceipt) => {
      try {
        const selectedPrinter = state.phase === "select_device"
          ? state.devices.find((d) => d.address === address)
          : null

        if (selectedPrinter) {
          savePrinter(selectedPrinter)
        }

        const selectedName = selectedPrinter?.name ?? address
        setState({ phase: "connecting", deviceName: selectedName })

        await connectAndPrint(selectedName, address, receipt)
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Gagal mencetak",
        })
      }
    },
    [connectAndPrint, savePrinter, state],
  )

  return {
    printState: state,
    preparedState,
    prepareBluetoothPrinter,
    printPreparedOrBluetooth,
    printViaBluetooth,
    selectAndPrint,
    reset,
    disconnectPreparedPrinter,
  }
}

/** Returns true if running in native Capacitor (android/ios), not browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
