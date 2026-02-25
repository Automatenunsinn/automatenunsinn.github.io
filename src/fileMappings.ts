// Unified configuration for UI options, loaders, and factory resets
export const deviceConfig: Record<string, {
    displayName: string;
    loaderFile: string;
    factoryFile?: string;
    compatibleFiles: string[];
    isFast: boolean;
}> = {
    // 512KB devices
    'roteDB': {
        displayName: '🟥 512KB',
        loaderFile: 'Loader_rote.bin',
        compatibleFiles: ['roteDB'],
        isFast: false
    },
    
    // 1MB devices
    'blaugelb1MB': {
        displayName: '🟦 1MB',
        loaderFile: 'Loader_3.0_alte_1mb.bin',
        factoryFile: 'Factory_3.0_alte_1mb.bin',
        compatibleFiles: ['blaugelb1MB'],
        isFast: true
    },
    'blaugelbUHG': {
        displayName: '🟦 1MB (UHG)',
        loaderFile: 'Loader_uhg.bin',
        factoryFile: 'Factory_3.0_alte_1mb.bin',
        compatibleFiles: ['blaugelbUHG'],
        isFast: false
    },
    'gelbeDB': {
        displayName: '🟨 1MB',
        loaderFile: 'Loader_5.0b_1MB_RD.bin',
        factoryFile: 'Factory_5.0a_1MB_Redesing_fur_512KB_images.bin',
        compatibleFiles: ['gelbeDB'],
        isFast: true
    },
    'gelbeDB_512k': {
        displayName: '🟨 1MB (512k)',
        loaderFile: 'Loader5.0_a_512KB_to_1MB.bin',
        factoryFile: 'Factory_5.0a_1MB_Redesing_fur_512KB_images.bin',
        compatibleFiles: ['roteDB'],
        isFast: true
    },
    
    // 2MB devices
    'lila2MB': {
        displayName: '🟪 2MB',
        loaderFile: 'Loader_5.0b_2MB.bin',
        factoryFile: 'Factory_2MB.bin',
        compatibleFiles: ['lila2MB'],
        isFast: true
    }
};

// File mappings by device type
export const fileMappings: Record<string, string[]> = {
    'roteDB': ['ALSUNA_EC1.bin'],
    'blaugelb1MB': ['ALEX_CC4.bin'],
    'blaugelbUHG': ['ASTERIX_UND_LATRAVIATA_C3.1.bin'],
    'gelbeDB': ['ALEX_CC5.bin'],
    'lila2MB': ['Money_X_CC2.bin']
};

export const BASE_URL = "https://example.com";