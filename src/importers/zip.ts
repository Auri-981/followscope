import { inflateSync } from "fflate";
import { ImportError } from "./types";

/**
 * Lector ZIP mínimo y defensivo.
 *
 * - Lee el directorio central mediante `Blob.slice`, sin cargar el ZIP entero
 *   en memoria (las exportaciones completas pueden ocupar varios GB).
 * - Solo descomprime las entradas que pide el llamador.
 * - Comprueba el tamaño declarado ANTES de descomprimir (protección frente a
 *   "zip bombs") y verifica tamaño y CRC32 después.
 * - Rechaza entradas cifradas y métodos de compresión no estándar.
 * - Nunca escribe en disco ni interpreta rutas: no hay riesgo de "zip slip".
 */

export interface ZipEntryInfo {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  encrypted: boolean;
  crc32: number;
  localHeaderOffset: number;
  /** Fecha de modificación de la entrada (hora local del ZIP), ISO. */
  modifiedAt?: string;
  isDirectory: boolean;
}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_CENTRAL_DIRECTORY = 64 * 1024 * 1024;

async function readSlice(blob: Blob, start: number, end: number): Promise<DataView> {
  const buffer = await blob.slice(start, end).arrayBuffer();
  return new DataView(buffer);
}

function u64(view: DataView, offset: number): number {
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  return high * 0x1_0000_0000 + low;
}

function dosDateToIso(date: number, time: number): string | undefined {
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  if (!day || !month || month > 12) return undefined;
  const d = new Date(year, month - 1, day, (time >> 11) & 0x1f, (time >> 5) & 0x3f, (time & 0x1f) * 2);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function isZip(blob: Blob): Promise<boolean> {
  if (blob.size < 4) return false;
  const view = await readSlice(blob, 0, 4);
  const sig = view.getUint32(0, true);
  return sig === SIG_LOCAL || sig === SIG_EOCD;
}

export async function listZipEntries(blob: Blob): Promise<ZipEntryInfo[]> {
  const tailSize = Math.min(blob.size, 22 + 0xffff);
  const tailStart = blob.size - tailSize;
  const tail = await readSlice(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ImportError("zip_invalid", "El archivo ZIP está dañado o incompleto (no se encuentra su índice).");

  let entryCount = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || tail.getUint32(locator, true) !== SIG_ZIP64_LOCATOR) {
      throw new ImportError("zip_invalid", "El archivo ZIP usa un formato ampliado que no se ha podido leer.");
    }
    const z64Offset = u64(tail, locator + 8);
    const z64 = await readSlice(blob, z64Offset, z64Offset + 56);
    if (z64.getUint32(0, true) !== SIG_ZIP64_EOCD) {
      throw new ImportError("zip_invalid", "El archivo ZIP está dañado (índice ampliado no válido).");
    }
    entryCount = u64(z64, 32);
    cdSize = u64(z64, 40);
    cdOffset = u64(z64, 48);
  }

  if (cdSize > MAX_CENTRAL_DIRECTORY || cdOffset + cdSize > blob.size) {
    throw new ImportError("zip_invalid", "El índice del archivo ZIP no es válido.");
  }

  const cd = await readSlice(blob, cdOffset, cdOffset + cdSize);
  const entries: ZipEntryInfo[] = [];
  const nameDecoder = new TextDecoder("utf-8");
  let p = 0;
  for (let i = 0; i < entryCount; i++) {
    if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== SIG_CENTRAL) {
      throw new ImportError("zip_invalid", "El índice del archivo ZIP está dañado.");
    }
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    const time = cd.getUint16(p + 12, true);
    const date = cd.getUint16(p + 14, true);
    const crc = cd.getUint32(p + 16, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let uncompressedSize = cd.getUint32(p + 24, true);
    const nameLength = cd.getUint16(p + 28, true);
    const extraLength = cd.getUint16(p + 30, true);
    const commentLength = cd.getUint16(p + 32, true);
    let localHeaderOffset = cd.getUint32(p + 42, true);
    const name = nameDecoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLength));

    // Campo extra ZIP64 (id 0x0001): solo contiene los valores que valen 0xFFFFFFFF.
    let e = p + 46 + nameLength;
    const extraEnd = e + extraLength;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const size = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = u64(cd, q);
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(cd, q);
          q += 8;
        }
        if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(cd, q);
      }
      e += 4 + size;
    }

    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      method,
      encrypted: (flags & 0x1) !== 0,
      crc32: crc,
      localHeaderOffset,
      modifiedAt: dosDateToIso(date, time),
      isDirectory: name.endsWith("/"),
    });
    p = extraEnd + commentLength;
  }
  return entries;
}

let crcTable: Uint32Array | undefined;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function extractZipEntry(blob: Blob, entry: ZipEntryInfo, maxBytes: number): Promise<Uint8Array> {
  if (entry.encrypted) {
    throw new ImportError("zip_encrypted", `«${entry.name}» está protegido con contraseña. Descomprime el ZIP y selecciona el archivo directamente.`);
  }
  if (entry.method !== 0 && entry.method !== 8) {
    throw new ImportError("zip_unsupported_compression", `«${entry.name}» usa un método de compresión no compatible.`);
  }
  if (entry.uncompressedSize > maxBytes) {
    throw new ImportError("zip_entry_too_large", `«${entry.name}» es demasiado grande para procesarlo con seguridad.`);
  }
  const header = await readSlice(blob, entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (header.getUint32(0, true) !== SIG_LOCAL) {
    throw new ImportError("zip_corrupt_entry", `«${entry.name}» está dañado dentro del ZIP.`);
  }
  const dataStart = entry.localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const compressed = new Uint8Array(await blob.slice(dataStart, dataStart + entry.compressedSize).arrayBuffer());
  if (compressed.length !== entry.compressedSize) {
    throw new ImportError("zip_corrupt_entry", `«${entry.name}» está incompleto dentro del ZIP.`);
  }

  let output: Uint8Array;
  if (entry.method === 0) {
    output = compressed;
  } else {
    // Búfer de salida del tamaño declarado: aunque el contenido real fuera mayor,
    // nunca se reserva más memoria; la comprobación de CRC detecta la discrepancia.
    try {
      output = inflateSync(compressed, { out: new Uint8Array(entry.uncompressedSize) });
    } catch {
      throw new ImportError("zip_corrupt_entry", `No se ha podido descomprimir «${entry.name}». El ZIP puede estar dañado.`);
    }
  }
  if (output.length !== entry.uncompressedSize || crc32(output) !== entry.crc32) {
    throw new ImportError("zip_corrupt_entry", `«${entry.name}» no supera la verificación de integridad. El ZIP puede estar dañado.`);
  }
  return output;
}
