import CryptoJS from 'crypto-js';
import MD5 from 'crypto-js/md5';
import { crc32 } from 'crc';
import { Buffer } from 'buffer';

export function parseDate(str: string): Date | null {
    if (!/^\d{6}$/.test(str)) return null;
    const yy = parseInt(str.slice(0, 2));
    const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;

    // Versuche YYMMDD
    let mm = parseInt(str.slice(2, 4));
    let dd = parseInt(str.slice(4, 6));
    let date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
        return date;
    }

    // Versuche YYDDMM
    mm = parseInt(str.slice(4, 6));
    dd = parseInt(str.slice(2, 4));
    date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
        return date;
    }

    return null;
}

// XC file info interface
export interface XcInfo {
    copyright: string;
    name: string;
    version: string;
    date: string;
    gameType: string;
    md5: string;
    crc32: string;
    size: number;
    manufacturer: string;
    dbtype: number;
    expectedSize: number;
}

const ManuMap = new Map([
    [0x6164, "adp"],
    [0x3141, "MEGA"],
    [0x5374, "Stella"]
]);

// Dump XC file info - shared between serial.ts and readout.ts
export function dumpXcInfo(data: Uint8Array, calculateHashes: boolean = true): XcInfo | null {
    if (data.length <= 0x100) {
        return null;
    }
    
    const decoder = new TextDecoder();
    
    // Extract fields at same offsets as readout.ts fillFields()
    const copyright = decoder.decode(data.slice(0x18, 0x4b)).trim();
    const name = decoder.decode(data.slice(0x60, 0x74)).trim();
    const version = decoder.decode(data.slice(0x75, 0x78)).trim();
    
    // Search for date from 0x7d to 0x99
    let dateStr = '';
    for (let i = 0x7d; i <= 0x99; i++) {
        const slice = data.slice(i, i + 6);
        const str = decoder.decode(slice);
        const date = parseDate(str);
        if (date) {
            dateStr = date.toISOString().slice(0, 10);
            break;
        }
    }
    
    // Search for game type: "-Spiel" from 0x84 to 0x96
    const gameTypeData = data.slice(0x84, 0x96);
    const gameTypeStr = decoder.decode(gameTypeData);
    const spielIndex = gameTypeStr.indexOf('-Spiel');
    let gameType = '';
    if (spielIndex !== -1 && spielIndex >= 4) {
        gameType = gameTypeStr.substring(spielIndex - 4, spielIndex + 6).trim();
    }
    
     // Extract expected size from bytes 0x04-0x07 (big-endian 32-bit)
     let expectedSize = 0;
     if (data.length >= 8) {
         expectedSize = ((data[0x04] << 24) | (data[0x05] << 16) | (data[0x06] << 8) | data[0x07]) - 0xFFF;
     }
     
     // Extract manufacturer and dbtype from bytes 0x0c-0x0f
     let manufacturer = 'Unbekannt';
     let dbtype = 0;
     
     if (data.length >= 16) {
         // Bytes 0x0c-0x0f: dbtype (big-endian 32-bit)
         dbtype = (data[0x0c] << 24) | (data[0x0d] << 16) | (data[0x0e] << 8) | data[0x0f];
         
         // Bytes 0x0c-0x0d: manufacturer code (big-endian 16-bit)
         const manuCode = (data[0x0c] << 8) | data[0x0d];
         manufacturer = ManuMap.get(manuCode) || `0x${manuCode.toString(16).toUpperCase()}`;
     }
    
    // Calculate hashes only if requested
    let md5Hash = '';
    let crc32Hash = '';
    
    if (calculateHashes) {
        md5Hash = MD5(CryptoJS.lib.WordArray.create(data as unknown as number[])).toString();
        crc32Hash = crc32(Buffer.from(data)).toString(16).padStart(8, '0');
    }
    
    return {
        copyright,
        name,
        version,
        date: dateStr,
        gameType,
        md5: md5Hash,
        crc32: crc32Hash,
        size: data.length,
        manufacturer,
        dbtype,
        expectedSize
    };
}