"use client"

import { useCallback, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { BluetoothSerial } from "@ascentio-it/capacitor-bluetooth-serial"
import { buildEscPosBytes, bytesToBtString, type EscPosReceipt } from "@/lib/escpos-print"

export type BtPrinterDevice = { name: string; address: string }

const SAVED_PRINTER_KEY = "pmk.btPrinter"

type BluetoothPermissionResult = boolean | { granted?: boolean }

const BLUETOOTH_PERMISSION_ERROR = "Izin Bluetooth tidak diberikan. Buka pengaturan untuk mengizinkan."

async function ensureBluetoothPermissions() {
  const result = await BluetoothSerial.checkBluetoothPermissions() as BluetoothPermissionResult
  return result === true || (typeof result === "object" && result.granted === true)
}

async function requireBluetoothPermissions() {
  const granted = await ensureBluetoothPermissions()
  if (!granted) throw new Error(BLUETOOTH_PERMISSION_ERROR)
}

async function getBluetoothEnabledState() {
  await requireBluetoothPermissions()
  return BluetoothSerial.isEnabled()
}

async function getBluetoothCanEnableState() {
  await requireBluetoothPermissions()
  return BluetoothSerial.canEnable()
}

async function enableBluetoothAdapter() {
  await requireBluetoothPermissions()
  return BluetoothSerial.enable()
}

async function getPairedBluetoothDevices() {
  await requireBluetoothPermissions()
  return BluetoothSerial.getPairedDevices()
}

async function connectBluetoothDevice(address: string) {
  await requireBluetoothPermissions()
  return BluetoothSerial.connect({ address })
}

async function disconnectBluetoothDevice(address: string) {
  await requireBluetoothPermissions()
  return BluetoothSerial.disconnect({ address })
}

async function writeBluetoothDevice(address: string, value: string) {
  await requireBluetoothPermissions()
  return BluetoothSerial.write({ address, value })
}

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

    for (let i = 0; i < btString.length; i += 512) {
      await writeBluetoothDevice(address, btString.slice(i, i + 512))
      await new Promise((r) => setTimeout(r, 25))
    }
    await new Promise((r) => setTimeout(r, 500))
  }, [])

  const disconnectPreparedPrinter = useCallback(async () => {
    prepareTokenRef.current += 1
    preparePromiseRef.current = null
    const printer = preparedPrinterRef.current
    preparedPrinterRef.current = null
    setPreparedState({ phase: "idle" })

    if (printer) {
      await disconnectBluetoothDevice(printer.address).catch(() => {})
    }
  }, [])

  const forgetBluetoothPrinter = useCallback(async () => {
    await disconnectPreparedPrinter()
    forgetSavedPrinter()
    setPreparedState({ phase: "idle" })
  }, [disconnectPreparedPrinter, forgetSavedPrinter])

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
        const btState = await getBluetoothEnabledState()
        if (!btState.enabled) throw new Error("Bluetooth is disabled")

        await connectBluetoothDevice(savedPrinter.address)

        if (prepareTokenRef.current !== token) {
          await disconnectBluetoothDevice(savedPrinter.address).catch(() => {})
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
        await connectBluetoothDevice(address)
        connected = true

        setState({ phase: "printing" })

        await writeReceipt(address, receipt)
      } finally {
        if (connected) {
          await disconnectBluetoothDevice(address).catch(() => {})
        }
      }

      setState({ phase: "done" })
    },
    [writeReceipt],
  )

  const ensureBluetoothReady = useCallback(async () => {
    setState({ phase: "checking_permissions" })

    try {
      await requireBluetoothPermissions()
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : BLUETOOTH_PERMISSION_ERROR,
      })
      return false
    }

    const btState = await getBluetoothEnabledState()
    if (!btState.enabled) {
      setState({ phase: "enabling" })
      const canEnable = await getBluetoothCanEnableState()
      if (canEnable.enabled) {
        await enableBluetoothAdapter()
      } else {
        setState({
          phase: "error",
          message: "Bluetooth tidak dapat diaktifkan. Silakan aktifkan secara manual.",
        })
        return false
      }
    }

    return true
  }, [])

  const listBluetoothPrinters = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return []

    try {
      const ready = await ensureBluetoothReady()
      if (!ready) return []

      setState({ phase: "scanning" })
      const paired = await getPairedBluetoothDevices()

      if (paired.devices.length === 0) {
        setState({
          phase: "error",
          message: "Tidak ditemukan printer yang dipasangkan. Pasangkan dulu printer melalui pengaturan Android.",
        })
        return []
      }

      setState({ phase: "idle" })
      return paired.devices
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Gagal mencari printer",
      })
      return []
    }
  }, [ensureBluetoothReady])

  const connectBluetoothPrinter = useCallback(async (printer: BtPrinterDevice) => {
    if (!Capacitor.isNativePlatform()) return false

    try {
      await disconnectPreparedPrinter()
      const ready = await ensureBluetoothReady()
      if (!ready) return false

      setState({ phase: "connecting", deviceName: printer.name })
      await connectBluetoothDevice(printer.address)
      preparedPrinterRef.current = printer
      savePrinter(printer)
      setPreparedState({ phase: "ready", deviceName: printer.name })
      setState({ phase: "done" })
      return true
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Gagal menghubungkan printer",
      })
      return false
    }
  }, [disconnectPreparedPrinter, ensureBluetoothReady, savePrinter])

  const printViaBluetooth = useCallback(
    async (receipt: EscPosReceipt) => {
      if (!Capacitor.isNativePlatform()) return

      try {
        const ready = await ensureBluetoothReady()
        if (!ready) return

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

        const paired = await getPairedBluetoothDevices()

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
    [connectAndPrint, ensureBluetoothReady, forgetSavedPrinter, getSavedPrinter, savePrinter],
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
        const ready = await ensureBluetoothReady()
        if (!ready) return

        setState({ phase: "printing" })
        await writeReceipt(preparedPrinter.address, receipt)
        setPreparedState({ phase: "ready", deviceName: preparedPrinter.name })
        setState({ phase: "done" })
      } catch {
        preparedPrinterRef.current = null
        setPreparedState({ phase: "failed" })
        forgetSavedPrinter()
        await disconnectBluetoothDevice(preparedPrinter.address).catch(() => {})
        await printViaBluetooth(receipt)
      }
    },
    [ensureBluetoothReady, forgetSavedPrinter, printViaBluetooth, writeReceipt],
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
        const ready = await ensureBluetoothReady()
        if (!ready) return

        setState({ phase: "connecting", deviceName: selectedName })

        await connectAndPrint(selectedName, address, receipt)
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Gagal mencetak",
        })
      }
    },
    [connectAndPrint, ensureBluetoothReady, savePrinter, state],
  )

  return {
    printState: state,
    preparedState,
    prepareBluetoothPrinter,
    printPreparedOrBluetooth,
    printViaBluetooth,
    listBluetoothPrinters,
    connectBluetoothPrinter,
    selectAndPrint,
    reset,
    disconnectPreparedPrinter,
    forgetBluetoothPrinter,
  }
}

/** Returns true if running in native Capacitor (android/ios), not browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
