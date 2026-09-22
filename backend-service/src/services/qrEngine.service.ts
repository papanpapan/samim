import QRCode from 'qrcode';

export interface LabelPayload {
  sku: string;
  commonName: string;
  bagSize: string;
  mrp: number | string;
  batchCode?: string;
}

// Encodes the label payload as a compact pipe-delimited string for the barcode/QR.
export function encodeLabelData(payload: LabelPayload): string {
  return [
    `SKU:${payload.sku}`,
    `NAME:${payload.commonName}`,
    `BAG:${payload.bagSize}`,
    `MRP:${payload.mrp}`,
    payload.batchCode ? `BATCH:${payload.batchCode}` : undefined,
  ]
    .filter(Boolean)
    .join('|');
}

// Generates a QR PNG data URL (thermal-label friendly).
export async function generateQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
  });
}

// Generates a QR as raw SVG string (vector for print).
export async function generateQrSvg(data: string): Promise<string> {
  return QRCode.toString(data, { type: 'svg', margin: 1 });
}
