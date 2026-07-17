import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const deviceHelperFile = join(
  process.cwd(),
  "node_modules/@ascentio-it/capacitor-bluetooth-serial/android/src/main/java/com/bluetoothserial/BluetoothDeviceHelper.java",
)

const pluginFile = join(
  process.cwd(),
  "node_modules/@ascentio-it/capacitor-bluetooth-serial/android/src/main/java/com/bluetoothserial/plugin/BluetoothSerialPlugin.java",
)

const manifestFile = join(
  process.cwd(),
  "node_modules/@ascentio-it/capacitor-bluetooth-serial/android/src/main/AndroidManifest.xml",
)

try {
  const source = readFileSync(deviceHelperFile, "utf8")
  const patched = source.replace(
    "return value.getBytes(StandardCharsets.UTF_8);",
    "return value.getBytes(StandardCharsets.ISO_8859_1);",
  )

  if (patched !== source) {
    writeFileSync(deviceHelperFile, patched)
    console.log("Patched capacitor-bluetooth-serial binary write charset")
  }
} catch (error) {
  console.warn("Skipped capacitor-bluetooth-serial charset patch:", error instanceof Error ? error.message : error)
}

try {
  const source = readFileSync(manifestFile, "utf8")
  let patched = source

  patched = patched.replace(
    `      <uses-permission
              android:name="android.permission.BLUETOOTH"
              android:maxSdkVersion="30" />`,
    `      <uses-permission android:name="android.permission.BLUETOOTH" />`,
  )

  patched = patched.replace(
    `      <uses-permission
              android:name="android.permission.BLUETOOTH_ADMIN"
              android:maxSdkVersion="30" />`,
    `      <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />`,
  )

  if (patched !== source) {
    writeFileSync(manifestFile, patched)
    console.log("Patched capacitor-bluetooth-serial legacy bluetooth manifest permissions")
  }
} catch (error) {
  console.warn("Skipped capacitor-bluetooth-serial manifest patch:", error instanceof Error ? error.message : error)
}

try {
  const source = readFileSync(pluginFile, "utf8")
  let patched = source

  patched = patched.replace(
    `        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN }, alias = BluetoothSerialPlugin.BLUETOOTH_API_31)`,
    `        @Permission(strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
        }, alias = BluetoothSerialPlugin.BLUETOOTH_API_31)`,
  )

  patched = patched.replace(
    `    public void getPairedDevices(PluginCall call) {
        if (bluetoothAdapter == null) {`,
    `    public void getPairedDevices(PluginCall call) {
        if (!checkPermissions(call, getPermissionAlias())) {
            return;
        }

        if (bluetoothAdapter == null) {`,
  )

  patched = patched.replace(
    `                case "connect":
                    connect(call);
                    break;
                case "enable":`,
    `                case "connect":
                    connect(call);
                    break;
                case "getPairedDevices":
                    getPairedDevices(call);
                    break;
                case "enable":`,
  )

  if (patched !== source) {
    writeFileSync(pluginFile, patched)
    console.log("Patched capacitor-bluetooth-serial paired-device permissions")
  }
} catch (error) {
  console.warn("Skipped capacitor-bluetooth-serial permission patch:", error instanceof Error ? error.message : error)
}
