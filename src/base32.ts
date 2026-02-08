export class CustomBase32 {
  static encBase32(v: number): string {
    if (v < 9) return String.fromCharCode(v + 49); // '1' to '9'

    let num = v + 56; // offset
    if (73 < num) num++; // Skip 'I'
    if (75 < num) num++; // Skip 'K'
    if (78 < num) num++; // Skip 'N'

    return String.fromCharCode(num);
  }

  static decBase32(u: string): number {
    u = u.toUpperCase();
    if (u < '1' || (u > '9' && u < 'A') || u === 'J' || u === 'L' || u === 'O' || u > 'Z') {
      throw new Error(`Invalid character: ${u}`);
    }

    if (u <= '9') return u.charCodeAt(0) - 49; // '1' to '9'
    let num = u.charCodeAt(0) - 56; // 'A' starts here

    if (u > 'I') num--; // Adjust for 'I'
    if (u > 'K') num--; // Adjust for 'K'
    if (u > 'N') num--; // Adjust for 'N'

    return num;
  }

  static base32Decode(code: string): Uint8Array {
    let value = 0;
    let offset = 0;
    const ncode: string = code.replace("l","1").replace("O","0");
    const result: number[] = [];

    for (const u of ncode) {
      if (u === ' ' || u === '-' || u === '_') continue; // Ignore spaces and dashes

      value |= CustomBase32.decBase32(u) << offset;
      offset += 5;

      if (offset >= 8) {
        result.push(value & 0xff); // Extract a byte
        value >>= 8;
        offset -= 8;
      }
    }

    return new Uint8Array(result);
  }

  static base32Encode(data: Uint8Array): string {
    let num2 = 0;
    let num3 = 0;
    let result = '';

    for (let i = 0; i < data.length; i++) {
      num2 |= data[i] << num3;
      num3 += 8;

      while (num3 >= 5) {
        result += CustomBase32.encBase32(num2 & 31); // Extract 5 bits and encode
        num2 >>= 5;
        num3 -= 5;
      }
    }

    if (num3 > 0) {
      result += CustomBase32.encBase32(num2 & 31);
    }

    return result;
  }
}

export default CustomBase32;