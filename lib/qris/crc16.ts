export function crc16(input: string) {
  let crc = 0xffff

  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0")
}
