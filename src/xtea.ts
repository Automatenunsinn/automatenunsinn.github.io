export class Xtea {
  private rounds: number = 32;
  private data1: number = 0;
  private data2: number = 0;
  private key: number[] = new Array(4).fill(0);

  /**
   * Sets the input data for encryption/decryption.
   * @param data A Uint8Array containing 8 bytes (64 bits) of data.
   */
  setData(data: Uint8Array): void {
    const databuffer = data.buffer.slice(data.byteOffset, data.byteLength + data.byteOffset); 

    this.data1 = new DataView(databuffer).getUint32(0, true); // Little-endian
    this.data2 = new DataView(databuffer).getUint32(4, true); // Little-endian
  }

  /**
   * Retrieves the encrypted/decrypted data as a Uint8Array.
   * @returns A Uint8Array containing 8 bytes (64 bits) of data.
   */
  getData(): Uint8Array {
    let gbuffer = new ArrayBuffer(8);
    let view = new DataView(gbuffer);
    view.setUint32(0, this.data1, true); // Little-endian
    view.setUint32(4, this.data2, true); // Little-endian
    return new Uint8Array(gbuffer);
  }

  /**
   * Initializes the key and data using a seed and rounds.
   * @param seed A 128-bit key as an array of four 32-bit unsigned integers.
   * @param rounds The number of encryption/decryption rounds.
   */
  init(seed: number[], rounds: number): void {
    if (seed.length !== 4) {
      throw new Error("Seed must be an array of four 32-bit unsigned integers.");
    }

    this.rounds = rounds;
    for (let i = 0; i < 4; i++) {
      this.key[i] = seed[i];
    }

    this.data1 = seed[2];
    this.data2 = seed[3];
    this.decrypt();
    this.key[0] = this.data1;
    this.key[2] = this.data2;
    this.encrypt();
    this.key[1] = this.data1;
    this.key[3] = this.data2;

    this.rounds = 32; // Reset rounds to the default for Encrypt/Decrypt
  }

  /**
   * Decrypts the current `data1` and `data2` using the XTEA algorithm.
   */
  decrypt(): void {
    let sum = 0xc6ef3720; // 0x9e3779b9 * 32
    const delta = 0x9e3779b9;

    for (let i = 0; i < this.rounds; i++) {
      this.data2 -= ((this.data1 << 4 ^ (this.data1 >>> 5)) + this.data1) ^ (sum + this.key[(sum >>> 11) & 3]);
      sum -= delta;
      this.data1 -= ((this.data2 << 4 ^ (this.data2 >>> 5)) + this.data2) ^ (sum + this.key[sum & 3]);
    }
  }

  /**
   * Encrypts the current `data1` and `data2` using the XTEA algorithm.
   */
  encrypt(): void {
    let sum = 0;
    const delta = 0x9e3779b9;

    for (let i = 0; i < this.rounds; i++) {
      this.data1 += ((this.data2 << 4 ^ (this.data2 >>> 5)) + this.data2) ^ (sum + this.key[sum & 3]);
      sum += delta;
      this.data2 += ((this.data1 << 4 ^ (this.data1 >>> 5)) + this.data1) ^ (sum + this.key[(sum >>> 11) & 3]);
    }
  }
}