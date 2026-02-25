export const BASE_URL = "https://example.com";

// Loader type to baud rate and size mapping
export const loaderConfig: Record<string, { baudRate: number; size: number; fast: boolean; loaderFile: string }> = {
    'roteDB': { baudRate: 57600, size: 512 * 1024, fast: false, loaderFile: 'loader_512k.bin' },
    'blaugelb1MB': { baudRate: 57600, size: 1024 * 1024, fast: true, loaderFile: 'loader_1mb.bin' },
    'blaugelbUHG': { baudRate: 57600, size: 1024 * 1024, fast: false, loaderFile: 'loader_uhg.bin' },
    'gelbeDB': { baudRate: 57600, size: 1024 * 1024, fast: true, loaderFile: 'loader_1mb.bin' },
    'lila2MB': { baudRate: 57600, size: 2 * 1024 * 1024, fast: true, loaderFile: 'loader_2mb.bin' },
};

export const roteDBFiles = [
  "ALSUNA_EC1.bin"
]

export const blaugelb1MBDBFiles = [
  "ALEX_CC4.bin"
];

export const blaugelbUHGDBFiles = [
  "ASTERIX_UND_LATRAVIATA_C3.1.bin"
];

export const gelbeDBFiles = [
  "ALEX_CC5.bin"
];

export const lila2MBFiles = [
  "Money_X_CC2.bin"
];

export const factoryResetFiles = [
  { name: "Factory Reset 2MB", bin: "Factory_2MB.bin", loader: "lila2MB" },
  { name: "Factory Reset 3.0 alte 1MB", bin: "Factory_3.0_alte_1mb.bin", loader: "blaugelb1MB" },
  { name: "Factory Reset 2.0", bin: "FactoryReset20.Xc", loader: "roteDB" },
  { name: "Factory Reset 5.0a 1MB (512KB images)", bin: "Factory_5.0a_1MB_Redesing_fur_512KB_images.bin", loader: "blaugelb1MB" }
]