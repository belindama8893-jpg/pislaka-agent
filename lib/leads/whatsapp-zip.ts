import { inflateRawSync } from "node:zlib";

export type ZipTextCandidate = {
  name: string;
  size: number;
};

type ZipEntry = ZipTextCandidate & {
  compressedSize: number;
  compressionMethod: number;
  dataOffset: number;
};

const maxZipEntries = 200;
const maxTxtBytes = 2_000_000;
const maxTotalUncompressedBytes = 6_000_000;
const eocdSignature = 0x06054b50;
const centralDirectorySignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function isUnsafePath(name: string) {
  return (
    name.startsWith("/") ||
    name.startsWith("\\") ||
    /^[A-Za-z]:/.test(name) ||
    name.split(/[\\/]+/).some((part) => part === "..")
  );
}

function looksLikeWhatsAppChatName(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith("_chat.txt") || lower.includes("whatsapp chat") || lower.includes("chat with");
}

function decodeFileName(raw: Buffer, flags: number) {
  if (flags & 0x800) {
    return raw.toString("utf8");
  }

  return raw.toString("utf8");
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 65_557);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === eocdSignature) {
      const commentLength = readUInt16(buffer, offset + 20);
      if (offset + 22 + commentLength <= buffer.length) {
        return {
          totalEntries: readUInt16(buffer, offset + 10),
          centralDirectorySize: readUInt32(buffer, offset + 12),
          centralDirectoryOffset: readUInt32(buffer, offset + 16)
        };
      }
    }
  }

  return null;
}

function getLocalDataOffset(buffer: Buffer, localHeaderOffset: number) {
  if (localHeaderOffset + 30 > buffer.length || readUInt32(buffer, localHeaderOffset) !== localFileHeaderSignature) {
    throw new Error("Zip archive has an invalid file header.");
  }

  const fileNameLength = readUInt16(buffer, localHeaderOffset + 26);
  const extraLength = readUInt16(buffer, localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;

  if (dataOffset > buffer.length) {
    throw new Error("Zip archive has an invalid file header.");
  }

  return dataOffset;
}

function parseCentralDirectory(bytes: ArrayBuffer) {
  const buffer = Buffer.from(bytes);
  const eocd = findEndOfCentralDirectory(buffer);

  if (!eocd) {
    throw new Error("This does not look like a valid zip export. Please upload the WhatsApp .txt file or re-export the chat as .zip.");
  }

  if (eocd.totalEntries > maxZipEntries) {
    throw new Error("Zip archive has too many files.");
  }

  if (eocd.centralDirectoryOffset + eocd.centralDirectorySize > buffer.length) {
    throw new Error("Zip archive appears incomplete or corrupted.");
  }

  const entries: ZipEntry[] = [];
  let offset = eocd.centralDirectoryOffset;
  let scanned = 0;
  let totalUncompressed = 0;

  while (offset + 46 <= buffer.length && scanned < eocd.totalEntries) {
    if (readUInt32(buffer, offset) !== centralDirectorySignature) {
      throw new Error("Zip archive appears incomplete or corrupted.");
    }

    scanned += 1;
    const flags = readUInt16(buffer, offset + 8);
    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const nextOffset = nameEnd + extraLength + commentLength;

    if (nameEnd > buffer.length || nextOffset > buffer.length) {
      throw new Error("Zip archive appears incomplete or corrupted.");
    }

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new Error("Zip64 WhatsApp exports are not supported yet. Please upload the chat .txt file instead.");
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxTotalUncompressedBytes) {
      throw new Error("Zip archive is too large after decompression.");
    }

    const name = decodeFileName(buffer.subarray(nameStart, nameEnd), flags);
    const dataOffset = getLocalDataOffset(buffer, localHeaderOffset);

    if (dataOffset + compressedSize > buffer.length) {
      throw new Error("Zip archive appears incomplete or corrupted.");
    }

    if (
      name.toLowerCase().endsWith(".txt") &&
      !isUnsafePath(name) &&
      uncompressedSize <= maxTxtBytes &&
      (compressionMethod === 0 || compressionMethod === 8) &&
      !(flags & 0x1)
    ) {
      entries.push({
        name,
        size: uncompressedSize,
        compressedSize,
        compressionMethod,
        dataOffset
      });
    }

    offset = nextOffset;
  }

  if (scanned !== eocd.totalEntries) {
    throw new Error("Zip archive appears incomplete or corrupted.");
  }

  if (scanned >= maxZipEntries && scanned < eocd.totalEntries) {
    throw new Error("Zip archive has too many files.");
  }

  return { buffer, entries };
}

export function listZipTextCandidates(bytes: ArrayBuffer): ZipTextCandidate[] {
  const { entries } = parseCentralDirectory(bytes);

  return entries.map(({ name, size }) => ({ name, size }));
}

function findZipEntry(bytes: ArrayBuffer, targetName: string) {
  const { buffer, entries } = parseCentralDirectory(bytes);
  const entry = entries.find((item) => item.name === targetName);

  return entry ? { ...entry, buffer } : null;
}

export function chooseZipTextCandidate(candidates: ZipTextCandidate[]) {
  if (!candidates.length) {
    return null;
  }

  const whatsappCandidates = candidates.filter((candidate) => looksLikeWhatsAppChatName(candidate.name));
  if (whatsappCandidates.length === 1) {
    return whatsappCandidates[0];
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

export function readZipTextFile(bytes: ArrayBuffer, name: string) {
  const entry = findZipEntry(bytes, name);

  if (!entry) {
    throw new Error("Selected chat text was not found in the zip archive.");
  }

  const compressed = entry.buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  let textBuffer: Buffer;

  try {
    textBuffer = entry.compressionMethod === 0 ? compressed : inflateRawSync(compressed);
  } catch {
    throw new Error("Could not read the chat text inside this zip. Please re-export the WhatsApp chat or upload the .txt file directly.");
  }

  if (textBuffer.byteLength > maxTxtBytes) {
    throw new Error("Selected chat text is too large.");
  }

  return textBuffer.toString("utf8");
}
