/**
 * BVELT Client-Side Binary EXIF Metadata Extractor
 * Pure TypeScript parser for JPEG APP1 / TIFF EXIF metadata without external dependencies.
 * Extracts GPS Coordinates (Latitude, Longitude, Altitude), Timestamp, Orientation, and Camera Model.
 */

export interface ExifData {
  dateTime?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  make?: string;
  model?: string;
  orientation?: number;
  hasGps: boolean;
  source: 'EXIF_EMBEDDED' | 'GEOLOCATION_API' | 'DEVICE_CLOCK';
}

/**
 * Extracts EXIF metadata from an Image File, Blob, or ArrayBuffer.
 */
export async function extractExifFromBlob(blobOrFile: Blob | File): Promise<ExifData> {
  const buffer = await blobOrFile.arrayBuffer();
  const parsed = parseJpegExif(buffer);

  if (parsed && (parsed.latitude !== undefined || parsed.dateTime !== undefined)) {
    return parsed;
  }

  // Fallback: If no GPS in EXIF, attempt browser Geolocation API if available and user permits
  let browserGps: { latitude: number; longitude: number } | null = null;
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      browserGps = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { timeout: 3000, enableHighAccuracy: true, maximumAge: 60000 }
        );
      }).catch(() => null);
    } catch {
      // Ignore geolocation prompt denial/timeout
    }
  }

  return {
    dateTime: parsed?.dateTime || (blobOrFile instanceof File && blobOrFile.lastModified ? new Date(blobOrFile.lastModified).toISOString() : new Date().toISOString()),
    latitude: parsed?.latitude ?? browserGps?.latitude,
    longitude: parsed?.longitude ?? browserGps?.longitude,
    altitude: parsed?.altitude,
    make: parsed?.make,
    model: parsed?.model,
    orientation: parsed?.orientation || 1,
    hasGps: !!(parsed?.latitude !== undefined || browserGps !== null),
    source: parsed?.latitude !== undefined ? 'EXIF_EMBEDDED' : (browserGps ? 'GEOLOCATION_API' : 'DEVICE_CLOCK')
  };
}

/**
 * Parses binary JPEG bytes for EXIF TIFF headers
 */
function parseJpegExif(buffer: ArrayBuffer): ExifData | null {
  const view = new DataView(buffer);

  // Validate JPEG SOI (0xFFD8)
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
    return null;
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset < length) {
    if (view.getUint8(offset) !== 0xFF) {
      break;
    }

    const marker = view.getUint8(offset + 1);

    // APP1 Marker (0xFFE1) contains EXIF
    if (marker === 0xE1) {
      const app1Length = view.getUint16(offset + 2, false);
      const exifHeaderOffset = offset + 4;

      // Check for "Exif\0\0" (0x45 0x78 0x69 0x66 0x00 0x00)
      if (
        view.getUint32(exifHeaderOffset, false) === 0x45786966 &&
        view.getUint16(exifHeaderOffset + 4, false) === 0x0000
      ) {
        const tiffOffset = exifHeaderOffset + 6;
        return parseTiffHeader(view, tiffOffset);
      }

      offset += 2 + app1Length;
    } else if (marker === 0xD9 || marker === 0xDA) {
      // EOI (End of Image) or SOS (Start of Scan) -> No EXIF ahead
      break;
    } else {
      const segmentLength = view.getUint16(offset + 2, false);
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/**
 * Parses TIFF header structure
 */
function parseTiffHeader(view: DataView, tiffOffset: number): ExifData | null {
  if (tiffOffset + 8 > view.byteLength) return null;

  const byteOrder = view.getUint16(tiffOffset, false);
  const isLittleEndian = byteOrder === 0x4949; // 'II' = Intel / Little-endian, 'MM' = Motorola / Big-endian

  if (byteOrder !== 0x4949 && byteOrder !== 0x4D4D) {
    return null;
  }

  // Validate 42 magic number
  if (view.getUint16(tiffOffset + 2, isLittleEndian) !== 42) {
    return null;
  }

  const ifd0Offset = view.getUint32(tiffOffset + 4, isLittleEndian);
  if (tiffOffset + ifd0Offset > view.byteLength) return null;

  let result: ExifData = {
    hasGps: false,
    source: 'EXIF_EMBEDDED'
  };

  let exifIfdOffset: number | null = null;
  let gpsIfdOffset: number | null = null;

  // 1. Read IFD0
  const ifd0Start = tiffOffset + ifd0Offset;
  const numEntries0 = view.getUint16(ifd0Start, isLittleEndian);
  let entryOffset = ifd0Start + 2;

  for (let i = 0; i < numEntries0; i++) {
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, isLittleEndian);
    const type = view.getUint16(entryOffset + 2, isLittleEndian);
    const count = view.getUint32(entryOffset + 4, isLittleEndian);
    const valueOffset = entryOffset + 8;

    if (tag === 0x010F) { // Make
      result.make = readString(view, tiffOffset, type, count, valueOffset, isLittleEndian);
    } else if (tag === 0x0110) { // Model
      result.model = readString(view, tiffOffset, type, count, valueOffset, isLittleEndian);
    } else if (tag === 0x0112) { // Orientation
      result.orientation = view.getUint16(valueOffset, isLittleEndian);
    } else if (tag === 0x0132) { // DateTime
      result.dateTime = readString(view, tiffOffset, type, count, valueOffset, isLittleEndian);
    } else if (tag === 0x8769) { // Exif IFD Pointer
      exifIfdOffset = view.getUint32(valueOffset, isLittleEndian);
    } else if (tag === 0x8825) { // GPS IFD Pointer
      gpsIfdOffset = view.getUint32(valueOffset, isLittleEndian);
    }

    entryOffset += 12;
  }

  // 2. Read Exif IFD if present (DateTimeOriginal / DateTimeDigitized)
  if (exifIfdOffset !== null && tiffOffset + exifIfdOffset < view.byteLength) {
    const exifStart = tiffOffset + exifIfdOffset;
    const numEntriesExif = view.getUint16(exifStart, isLittleEndian);
    let exifEntryOffset = exifStart + 2;

    for (let i = 0; i < numEntriesExif; i++) {
      if (exifEntryOffset + 12 > view.byteLength) break;
      const tag = view.getUint16(exifEntryOffset, isLittleEndian);
      const type = view.getUint16(exifEntryOffset + 2, isLittleEndian);
      const count = view.getUint32(exifEntryOffset + 4, isLittleEndian);
      const valueOffset = exifEntryOffset + 8;

      if ((tag === 0x9003 || tag === 0x9004) && !result.dateTime) {
        result.dateTime = readString(view, tiffOffset, type, count, valueOffset, isLittleEndian);
      }
      exifEntryOffset += 12;
    }
  }

  // 3. Read GPS IFD if present
  if (gpsIfdOffset !== null && tiffOffset + gpsIfdOffset < view.byteLength) {
    const gpsStart = tiffOffset + gpsIfdOffset;
    const numEntriesGps = view.getUint16(gpsStart, isLittleEndian);
    let gpsEntryOffset = gpsStart + 2;

    let latRef = 'N';
    let lonRef = 'E';
    let rawLat: number[] | null = null;
    let rawLon: number[] | null = null;
    let rawAlt: number | null = null;

    for (let i = 0; i < numEntriesGps; i++) {
      if (gpsEntryOffset + 12 > view.byteLength) break;
      const tag = view.getUint16(gpsEntryOffset, isLittleEndian);
      const type = view.getUint16(gpsEntryOffset + 2, isLittleEndian);
      const count = view.getUint32(gpsEntryOffset + 4, isLittleEndian);
      const valueOffset = gpsEntryOffset + 8;

      if (tag === 0x0001) { // GPSLatitudeRef
        latRef = String.fromCharCode(view.getUint8(valueOffset));
      } else if (tag === 0x0002) { // GPSLatitude
        rawLat = readRationals(view, tiffOffset, type, count, valueOffset, isLittleEndian);
      } else if (tag === 0x0003) { // GPSLongitudeRef
        lonRef = String.fromCharCode(view.getUint8(valueOffset));
      } else if (tag === 0x0004) { // GPSLongitude
        rawLon = readRationals(view, tiffOffset, type, count, valueOffset, isLittleEndian);
      } else if (tag === 0x0006) { // GPSAltitude
        const alts = readRationals(view, tiffOffset, type, count, valueOffset, isLittleEndian);
        if (alts && alts.length > 0) rawAlt = alts[0];
      }

      gpsEntryOffset += 12;
    }

    if (rawLat && rawLat.length >= 3) {
      const deg = rawLat[0] + rawLat[1] / 60 + rawLat[2] / 3600;
      result.latitude = (latRef === 'S') ? -deg : deg;
    }

    if (rawLon && rawLon.length >= 3) {
      const deg = rawLon[0] + rawLon[1] / 60 + rawLon[2] / 3600;
      result.longitude = (lonRef === 'W') ? -deg : deg;
    }

    if (rawAlt !== null) {
      result.altitude = rawAlt;
    }

    if (result.latitude !== undefined && result.longitude !== undefined) {
      result.hasGps = true;
    }
  }

  // Format ISO DateTime if formatted as "YYYY:MM:DD HH:MM:SS"
  if (result.dateTime && result.dateTime.includes(':')) {
    const parts = result.dateTime.trim().split(' ');
    if (parts.length === 2) {
      const datePart = parts[0].replace(/:/g, '-');
      const timePart = parts[1];
      const isoCandidate = `${datePart}T${timePart}Z`;
      if (!isNaN(Date.parse(isoCandidate))) {
        result.dateTime = isoCandidate;
      }
    }
  }

  return result;
}

function readString(
  view: DataView,
  tiffOffset: number,
  type: number,
  count: number,
  valueOffset: number,
  isLittleEndian: boolean
): string | undefined {
  if (count <= 4) {
    let str = '';
    for (let i = 0; i < count; i++) {
      const charCode = view.getUint8(valueOffset + i);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str.trim();
  }

  const offset = tiffOffset + view.getUint32(valueOffset, isLittleEndian);
  if (offset + count > view.byteLength) return undefined;

  let str = '';
  for (let i = 0; i < count; i++) {
    const charCode = view.getUint8(offset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}

function readRationals(
  view: DataView,
  tiffOffset: number,
  type: number,
  count: number,
  valueOffset: number,
  isLittleEndian: boolean
): number[] | null {
  const offset = tiffOffset + view.getUint32(valueOffset, isLittleEndian);
  const result: number[] = [];

  for (let i = 0; i < count; i++) {
    const pos = offset + i * 8;
    if (pos + 8 > view.byteLength) return null;
    const numerator = view.getUint32(pos, isLittleEndian);
    const denominator = view.getUint32(pos + 4, isLittleEndian);
    if (denominator === 0) {
      result.push(0);
    } else {
      result.push(numerator / denominator);
    }
  }

  return result;
}
