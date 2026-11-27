import QRCode from 'qrcode'

// The e-ticket's QR code holds only the booking reference (e.g. "CV-7K2QXM"); the crew looks it up in /admin.

export function qrPng(ref: string, size = 320) {
  return QRCode.toBuffer(ref, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: size, color: { dark: '#0F2430', light: '#FFFFFF' } })
}

export function qrSvg(ref: string) {
  return QRCode.toString(ref, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0F2430', light: '#FFFFFF' } })
}
