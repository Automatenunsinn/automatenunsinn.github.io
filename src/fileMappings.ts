// Unified configuration for UI options, loaders, and factory resets
export const deviceConfig: Record<string, {
    displayName: string;
    loaderFile: string;
    factoryFile?: string;
    compatibleFiles: string[];
    isFast: boolean;
}> = {
    // 512KB devices
    '31415900': {
        displayName: '🟥 512KB',
        loaderFile: '31415900_L2.0.bin',
        factoryFile: '31415926_L2.0.bin',
        compatibleFiles: ['31415900'],
        isFast: false
    },

    // 1MB devices
    '61647000': {
        displayName: '🟦 1MB',
        loaderFile: '61647000.bin',
        factoryFile: '61647002.bin',
        compatibleFiles: ['61647000'],
        isFast: true
    },
    '53746c00': {
        displayName: '🟦 1MB (UHG)',
        loaderFile: '53746c00.bin',
        factoryFile: '61647002.bin',
        compatibleFiles: ['53746c00'],
        isFast: false
    },
    '61640300': {
        displayName: '🟨 1MB',
        loaderFile: '61640300.bin',
        factoryFile: '61640302.bin',
        compatibleFiles: ['61640300'],
        isFast: true
    },
    '31415926': {
        displayName: '🟨 1MB (512k)',
        loaderFile: '31415926_L5.0a.bin',
        factoryFile: '31415926_L5.0a.bin',
        compatibleFiles: ['31415900'],
        isFast: true
    },

    '61640400': {
        displayName: '🟪 2MB',
        loaderFile: '61640400.bin',
        factoryFile: '61640403.bin',
        compatibleFiles: ['61640400'],
        isFast: true
    }
};

// File mappings by device type
export const fileMappings: Record<string, string[]> = {
    '31415900': ["ALSUNA_EC1.bin",
        "ANNO_TOBAK_G_EC1.bin",
        "BLUE_BALL_12_C2_.bin",
        "BLUE_POWER_D12_CC4.bin",
        "BOBBY_D12_CC1.bin",
        "BRAVO_E3.bin",
        "BRAVO_H1.bin",
        "BREAK_OUT_CC2.bin",
        "BREAK_OUT_CC3.bin",
        "BRILLANT_D12_CC2.bin",
        "BRISANT_EC1.bin",
        "JOKER_G_C1.bin",
        "BUNGEE_EC2_.bin",
        "CAIRO_150_D12_CC3.bin",
        "CAIRO_150_D12_CC4.bin",
        "CASHFUN_D12_CC3.bin",
        "CASTELL_EC1.bin",
        "CHILI_D12_CC1.bin",
        "CHILI_D12_CC2.bin",
        "CINEMA_D12_CC1.bin",
        "COCKTAILS_CC3.bin",
        "CRISS_CROSS_CC2.bin",
        "CROCO_D12_CC2.bin",
        "DIEGO_D12_CC2.bin",
        "DIEGO_D12_CC3.bin",
        "DUBLIN_D12_CC1.bin",
        "DUBLIN_D12_CC3.bin",
        "DYNASTY_12_C1.bin",
        "FOCUS_EC1.bin",
        "GARANT_G_EC1.bin",
        "GLUECKAUF_D12_CC1.bin",
        "GOLDEN_FIGHT_D12_C1.bin",
        "GOLD_STAR_D12_CC1.bin",
        "HAPPY_EC1.bin",
        "HAPPY_H1.bin",
        "HIGHLIGHT_WINNER_EC2.bin",
        "HOT_PEPPER_CC2.bin",
        "IMPULS_100_D12_CC2.bin",
        "JOKER_G_EC2.bin",
        "JOKER_HERZ_AS_C1.bin",
        "JOKER_HERZ_AS_E1.bin"],
    '61647000': ["ALEX_CC4.bin",
        "DUBLIN_D12_CC3.bin",
        "EGYPT_FUN_D12_CC3.bin",
        "FUN_MASTER_STAND_C4.bin",
        "GOLD_PLAY_DELUXE_CC4.bin",
        "HOT_CHERRY_CC6.bin",
        "HOT_DOG_CC8.bin",
        "JAZZ_CC4.bin",
        "LAOLA_CC6.bin",
        "LOTUS_D12_CC2.bin"],
    '53746c00': ["ASTERIX_BEST_OF_C1.bin",
        "ASTERIX_UND_LATRAVIATA_C3.1.bin",
        "BLACK_JACK_VARIO_W3.bin",
        "CASH_HUNTER_D_C2.bin",
        "ESPRIT_VIDEO_CC2_.bin",
        "FUN_CITY_C1.bin",
        "FUN_CITY_PAS_C4.bin",
        "FUN_CITY_PRO_DUO_E2.1.bin",
        "FUN_CITY_PRO_E2.1.bin",
        "FUN_MASTER_C3.bin",
        "FUN_MASTER_STAND_C4.bin",
        "LUCKY_LUKE_C3_D.bin",
        "MOORHUHN_E5.bin"],
    '61640300': ["ALEX_CC5.bin",
        "FUN_MASTER_STAND_C4.bin",
        "GOLD_PLAY_DELUXE_CC4.bin",
        "HOT_CHERRY_CC6.bin",
        "WILD_WATER_CC4.bin",
        "SONNE_CC3.bin"
    ],
    '61640400': ["Money_X_CC2.bin"]
};

export const BASE_URL = "./datenbanken";