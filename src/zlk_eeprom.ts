import { patchEEPROM, generatePatchData } from './eeprom';
import abCheck from './abCheck';

declare global {
  interface Window {
    patchCode: () => void;
    populateMachines: () => void;
  }
}

const v2Machines = {
  "ADP 1002 (NEW STAR JP)": new Uint8Array([6, 50, 2, 135]),
  "ADP 1002 (NEW STAR)": new Uint8Array([6, 50, 2, 135]),
  "ADP 1003 (GOOD LUCK)": new Uint8Array([6, 50, 2, 101]),
  "ADP 1005 (CONFETTI)": new Uint8Array([6, 50, 129, 144]),
  "ADP 1005 (FILOU)": new Uint8Array([6, 50, 129, 25]),
  "ADP 1005 (MEGA WINNER)": new Uint8Array([6, 50, 129, 25]),
  "ADP 1006 (FIRST PARTY)": new Uint8Array([6, 50, 146, 25]),
  "ADP 1006 (FUN BOX)": new Uint8Array([6, 50, 146, 25]),
  "ADP 1010 (LOADED)": new Uint8Array([6, 50, 2, 131]),
  "ADP 1012 (TRIO STANDGERÄT)": new Uint8Array([6, 50, 129, 33]),
  "ADP 1017 (MULTI MULTI ERGOLINE)": new Uint8Array([6, 50, 2, 145]),
  "ADP 1020 (WAIKIKI)": new Uint8Array([6, 50, 146, 32]),
  "ADP 1020 (DRIBBLER)": new Uint8Array([6, 50, 146, 32]),
  "ADP 1038 (MULTI MULTI STAND)": new Uint8Array([6, 50, 2, 146]),
  "ADP 1181 (TALER GASTRO) CC3": new Uint8Array([6, 50, 146, 51]),
  "ADP 1187 (HOT FIVE)": new Uint8Array([6, 50, 129, 105]),
  "ADP 1222 (20 SPIELE)": new Uint8Array([6, 50, 130, 2]),
  "ADP 1223 (LOKAL RUNDE)": new Uint8Array([6, 50, 146, 86]),
  "ADP 1230 (SERIEN POWER) CC3": new Uint8Array([6, 50, 146, 87]),
  "ADP 1243 (CRISS CROSS CAFE)": new Uint8Array([6, 50, 146, 81]),
  "ADP 1081 BLUE DIAMOND": new Uint8Array([6, 50, 3, 96]),
  "ALEX (BERLIN)": new Uint8Array([6, 50, 146, 24]),
  "ADDERS&LADDERS": new Uint8Array([6, 50, 1, 50]),
  "ALEX": new Uint8Array([6, 50, 146, 24]),
  "ANNO TOBAK G EC1": new Uint8Array([6, 50, 0, 132]),
  "AVANTI": new Uint8Array([6, 50, 129, 6]),
  "BLUE BALL": new Uint8Array([6, 50, 128, 72]),
  "BLUE POWER": new Uint8Array([6, 50, 128, 148]),
  "BOBBY": new Uint8Array([6, 50, 1, 73]),
  "BRAVO": new Uint8Array([6, 50, 128, 5]),
  "BREAK OUT": new Uint8Array([6, 50, 2, 89]),
  "BRILLANT": new Uint8Array([6, 50, 1, 118]),
  "BRISANT": new Uint8Array([6, 50, 128, 1]),
  "BUNGEE": new Uint8Array([6, 50, 128, 33]),
  "CAIRO 150": new Uint8Array([6, 50, 128, 133]),
  "CASHFUN": new Uint8Array([6, 50, 2, 24]),
  "CARIBIC C1": new Uint8Array([6, 50, 128, 105]),
  "CASTELL": new Uint8Array([6, 50, 0, 2]),
  "CHILI": new Uint8Array([6, 50, 128, 113]),
  "CINEMA": new Uint8Array([6, 50, 128, 152]),
  "COCKTAILS": new Uint8Array([6, 50, 2, 89]),
  "CRISS CROSS (TWENTY SEVEN)": new Uint8Array([6, 50, 129, 9]),
  "CRISS CROSS": new Uint8Array([6, 50, 129, 9]),
  "CROWN JEWELS CC3": new Uint8Array([6, 50, 2, 81]),
  "CRUISER": new Uint8Array([6, 50, 146, 23]),
  "DIEGO": new Uint8Array([6, 50, 1, 133]),
  "DUBLIN": new Uint8Array([6, 50, 128, 153]),
  "DYNASTY": new Uint8Array([6, 50, 128, 67]),
  "EGYPT FUN": new Uint8Array([6, 50, 2, 35]),
  "ESPRIT VIDEO": new Uint8Array([6, 50, 146, 9]),
  "FOCUS EC1": new Uint8Array([6, 50, 0, 80]),
  "FUN CITY PAS": new Uint8Array([6, 50, 52, 65]),
  "FUN CITY PRO": new Uint8Array([6, 50, 54, 4]),
  "FUN MASTER": new Uint8Array([6, 50, 53, 134]),
  "GARANT G": new Uint8Array([6, 50, 0, 129]),
  "GLUECKAUF": new Uint8Array([6, 50, 1, 136]),
  "GOLD PLAY": new Uint8Array([6, 50, 146, 19]),
  "GOLD PLAY DELUXE": new Uint8Array([6, 50, 146, 19]),
  "GOLD STAR": new Uint8Array([6, 50, 128, 66]),
  "GOOD LUCK": new Uint8Array([6, 50, 146, 17]),
  "HAPPY": new Uint8Array([6, 50, 0, 4]),
  "HIGHLIGHT WINNER": new Uint8Array([6, 50, 0, 65]),
  "HOT CHERRY (LUCKY DAY)": new Uint8Array([6, 50, 129, 24]),
  "HOT CHERRY": new Uint8Array([6, 50, 129, 24]),
  "HOT DOG (NIGHT)": new Uint8Array([6, 50, 129, 20]),
  "HOT DOG": new Uint8Array([6, 50, 129, 20]),
  "HOT PEPPER": new Uint8Array([6, 50, 129, 21]),
  "IMPULS 100": new Uint8Array([6, 50, 146, 1]),
  "JAZZ": new Uint8Array([6, 50, 129, 0]),
  "JOKER G": new Uint8Array([6, 50, 0, 135]),
  "JOKER HERZ AS": new Uint8Array([6, 50, 54, 20]),
  "KAISER BON BON": new Uint8Array([6, 50, 146, 5]),
  "KAISER COOL": new Uint8Array([6, 50, 146, 2]),
  "KAISER CROCO": new Uint8Array([6, 50, 128, 147]),
  "KAISER MAGIER": new Uint8Array([6, 50, 146, 0]),
  "LADY BLUE QUICK": new Uint8Array([6, 50, 1, 57]),
  "LAOLA (FINALE 2010)": new Uint8Array([6, 50, 146, 17]),
  "LAOLA": new Uint8Array([6, 50, 146, 17]),
  "LOTUS": new Uint8Array([6, 50, 2, 37]),
  "MEGA 199": new Uint8Array([6, 50, 128, 69]),
  "MEGA AIR": new Uint8Array([6, 50, 128, 112]),
  "MERKUR EURO CUP D12": new Uint8Array([6, 50, 1, 117]),
  "MEGA DENVER": new Uint8Array([6, 50, 128, 97]),
  "MEGA GHOST": new Uint8Array([6, 50, 128, 121]),
  "MEGA MEXICO": new Uint8Array([6, 50, 128, 131]),
  "MEGA PAN": new Uint8Array([6, 50, 128, 102]),
  "MEGA ROAD": new Uint8Array([6, 50, 128, 132]),
  "MEGA ZACK": new Uint8Array([6, 50, 128, 99]),
  "MEGA LIFE": new Uint8Array([6, 50, 128, 100]),
  "MEGA TURBO SUNNY": new Uint8Array([6, 50, 128, 56]),
  "MEGA-X": new Uint8Array([6, 50, 128, 54]),
  "MERKUR 2000": new Uint8Array([6, 50, 0, 81]),
  "MERKUR 5000": new Uint8Array([6, 50, 1, 23]),
  "MERKUR ALSUNA": new Uint8Array([6, 50, 0, 137]),
  "MERKUR AZZURO": new Uint8Array([6, 50, 1, 96]),
  "MERKUR BEAMER": new Uint8Array([6, 50, 2, 53]),
  "MERKUR CASHFIRE": new Uint8Array([6, 50, 2, 57]),
  "MERKUR CHARLY": new Uint8Array([6, 50, 1, 53]),
  "MERKUR CRAZY MONEY": new Uint8Array([6, 50, 41, 9]),
  "MERKUR DORO": new Uint8Array([6, 50, 1, 84]),
  "MERKUR EURO CUP": new Uint8Array([6, 50, 1, 117]),
  "MERKUR GOLDPOKAL": new Uint8Array([6, 50, 1, 51]),
  "MERKUR GOLD CUP": new Uint8Array([6, 50, 0, 149]),
  "MERKUR JACKPOT C J": new Uint8Array([6, 50, 40, 5]),
  "MERKUR JACKPOT SL": new Uint8Array([6, 50, 40, 5]),
  "MERKUR LASER": new Uint8Array([6, 50, 2, 5]),
  "MERKUR LUCKY STAR": new Uint8Array([6, 50, 2, 49]),
  "MERKUR MISTRAL": new Uint8Array([6, 50, 1, 105]),
  "MERKUR MULTI CASINO": new Uint8Array([6, 50, 2, 118]),
  "MERKUR MULTI ERGOLINE": new Uint8Array([6, 50, 2, 116]),
  "MERKUR MULTI STAND": new Uint8Array([6, 50, 2, 117]),
  "MERKUR ORCA": new Uint8Array([6, 50, 1, 102]),
  "MERKUR RONDO": new Uint8Array([6, 50, 1, 82]),
  "MERKUR RONDO N": new Uint8Array([6, 50, 1, 82]),
  "MERKUR STAR": new Uint8Array([6, 50, 2, 56]),
  "MERKUR STAR S": new Uint8Array([6, 50, 2, 56]),
  "MERKUR STIXX": new Uint8Array([6, 50, 1, 72]),
  "MERKUR STRATOS": new Uint8Array([6, 50, 0, 116]),
  "MERKUR THUNDER": new Uint8Array([6, 50, 1, 68]),
  "MERKUR TOP 180": new Uint8Array([6, 50, 2, 2]),
  "MERKUR TORNADO": new Uint8Array([6, 50, 1, 115]),
  "MERKUR TOWERS": new Uint8Array([6, 50, 1, 86]),
  "MERKUR XXL": new Uint8Array([6, 50, 1, 49]),
  "MERKUR XXL SUPER": new Uint8Array([6, 50, 1, 69]),
  "MERKUR EUROSTAR": new Uint8Array([6, 50, 0, 152]),
  "MIAMI": new Uint8Array([6, 50, 128, 117]),
  "MOSQUITO": new Uint8Array([6, 50, 2, 98]),
  "NEW WINNER (BIG JACKPOT)": new Uint8Array([6, 50, 129, 5]),
  "NEW WINNER (EUROBANK)": new Uint8Array([6, 50, 129, 5]),
  "NEW WINNER": new Uint8Array([6, 50, 129, 5]),
  "NEXT GENERATION": new Uint8Array([6, 50, 128, 80]),
  "OCEAN": new Uint8Array([6, 50, 128, 135]),
  "OKTA": new Uint8Array([6, 50, 128, 146]),
  "OLYMP": new Uint8Array([6, 50, 128, 19]),
  "PALACE": new Uint8Array([6, 50, 0, 69]),
  "PEPPER": new Uint8Array([6, 50, 129, 2]),
  "PLAYERS INN": new Uint8Array([6, 50, 128, 66]),
  "POKER POT": new Uint8Array([6, 50, 98, 73]),
  "POKER STAR": new Uint8Array([6, 50, 1, 97]),
  "POWER HERZ AS": new Uint8Array([6, 50, 98, 119]),
  "PRIMA VERA G": new Uint8Array([6, 50, 0, 121]),
  "QUICK BINGO D": new Uint8Array([6, 50, 40, 83]),
  "RAINBOW": new Uint8Array([6, 50, 1, 88]),
  "RAPTOR": new Uint8Array([6, 50, 146, 21]),
  "RODEO G": new Uint8Array([6, 50, 0, 148]),
  "RONDO STEP 1": new Uint8Array([6, 50, 1, 134]),
  "RONDO STEP 2": new Uint8Array([6, 50, 1, 150]),
  "SAM": new Uint8Array([6, 50, 128, 65]),
  "SAPHIR G": new Uint8Array([6, 50, 128, 49]),
  "SCIROCCO": new Uint8Array([6, 50, 2, 25]),
  "SEKT ODER SELTERS": new Uint8Array([6, 50, 53, 118]),
  "SHARK": new Uint8Array([6, 50, 128, 89]),
  "SHOWDOWN": new Uint8Array([6, 50, 128, 0]),
  "SIRIUS (GAMBLERS INN)": new Uint8Array([6, 50, 129, 19]),
  "SIRIUS JACKPOT": new Uint8Array([6, 50, 129, 18]),
  "SIRIUS JACKPOT EXT": new Uint8Array([6, 50, 129, 18]),
  "SONNE": new Uint8Array([6, 50, 128, 0]),
  "SONNENFREAKS": new Uint8Array([6, 50, 0, 33]),
  "SONNENFUERST G": new Uint8Array([6, 50, 0, 133]),
  "SPACE STAR": new Uint8Array([6, 50, 0, 84]),
  "STRIKE": new Uint8Array([6, 50, 128, 38]),
  "SUPER ACTION": new Uint8Array([6, 50, 0, 55]),
  "SUPER JOLLI.": new Uint8Array([6, 50, 52, 57]),
  "SUPER TAIFUN": new Uint8Array([6, 50, 1, 135]),
  "TAIFUN": new Uint8Array([6, 50, 1, 24]),
  "TAIFUN QUICK": new Uint8Array([6, 50, 1, 68]),
  "TEXAS": new Uint8Array([6, 50, 128, 145]),
  "TOOOR": new Uint8Array([6, 50, 128, 151]),
  "TRIPLE POKER": new Uint8Array([6, 50, 129, 6]),
  "TUNING MALLORCA EC1": new Uint8Array([6, 50, 0, 131]),
  "TUNING RIO G": new Uint8Array([6, 50, 0, 37]),
  "TURBO DISC": new Uint8Array([6, 50, 0, 99]),
  "TWIST": new Uint8Array([6, 50, 1, 148]),
  "TAIFUN BISTRO": new Uint8Array([6, 50, 1, 103]),
  "WILD WATER": new Uint8Array([6, 50, 129, 16]),
  "WINNER SQ": new Uint8Array([6, 50, 129, 4]),
  "WORLD CUP 50 SONDERSPIELE": new Uint8Array([6, 50, 1, 25]),
  "WORLD CUP 150 SONDERSPIELE D12 CC1": new Uint8Array([6, 50, 2, 51]),
  "YUPPIE 12 EC1": new Uint8Array([6, 50, 128, 39])
}

const v3Machines = {
  "Ergoline M88": new Uint8Array([6, 50, 18, 50]),
  "Ergoline M90": new Uint8Array([6, 50, 17, 85]),
  "Ergoline M111": new Uint8Array([6, 50, 48, 0]),
  "Ergoline M140": new Uint8Array([6, 50, 19, 105]),
  "Ergoline M202": new Uint8Array([6, 50, 32, 2]),
  "Ergoline M205": new Uint8Array([6, 50, 32, 2]),
  "Casinoline M88": new Uint8Array([6, 50, 17, 84]),
  "Casinoline M90": new Uint8Array([6, 50, 17, 144]),
  "Casinoline M111": new Uint8Array([6, 50, 57, 7]),
  "Casinoline M202": new Uint8Array([6, 50, 32, 18]),
  "Casinoline M205": new Uint8Array([6, 50, 32, 18]),
  "Slimline M88": new Uint8Array([6, 50, 18, 52]),
  "Slimline M90": new Uint8Array([6, 50, 17, 96]),
  "Slimline M111": new Uint8Array([6, 50, 57, 25]),
  "Slimline M202": new Uint8Array([6, 50, 32, 4]),
  "Slimline M205": new Uint8Array([6, 50, 32, 4]),
  "Slantop M88": new Uint8Array([6, 50, 17, 112]),
  "Slantop M90": new Uint8Array([6, 50, 18, 9]),
  "Slantop M111": new Uint8Array([6, 50, 50, 1]),
  "Slantop M140": new Uint8Array([6, 50, 19, 101]),
  "Slantop M202": new Uint8Array([6, 50, 32, 8]),
  "Slantop M205": new Uint8Array([6, 50, 32, 8]),
  "VisionSlantop M88": new Uint8Array([6, 50, 17, 121]),
  "VisionSlantop M111": new Uint8Array([6, 50, 50, 3]),
  "VisionSlantop M202": new Uint8Array([6, 50, 32, 16]),
  "VisionSlantop M205": new Uint8Array([6, 50, 50, 17]),
  "VisionWand M88": new Uint8Array([6, 50, 17, 105]),
  "VisionWand M90": new Uint8Array([6, 50, 18, 7]),
  "VisionWand M111": new Uint8Array([6, 50, 57, 18]),
  "VisionWand M202": new Uint8Array([6, 50, 32, 20]),
  "VisionWand M205": new Uint8Array([6, 50, 32, 20])
}

const allMachines = { ...v2Machines, ...v3Machines };

export function populateMachines() {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  for (const key in allMachines) {
    const option = <HTMLOptionElement>document.createElement('option');
    option.value = key;
    option.textContent = key;
    machineSelect.appendChild(option);
  }
}

export default function patchCode(): void {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const serial = (<HTMLInputElement>document.getElementById('serialInput')).value.trim();
  const key = machineSelect.value;

  if (!serial) return alert("Bitte die neunstellige Zulassungsnummer eingeben.");

  try {
    const EEPROM_SIZE = 256;
    let eeprom = new Uint8Array(EEPROM_SIZE).fill(0xFF);
    if (abCheck()) eeprom.fill(0x00, 0, 0x4E);

    const { patch1, patch2 } = generatePatchData(serial, key, v2Machines, v3Machines);

    let patched = patchEEPROM({ file: eeprom.buffer as ArrayBuffer, startOffset: 64, newData: patch1 });
    patched = patchEEPROM({ file: patched.buffer as ArrayBuffer, startOffset: 40, newData: patch2 });

    const blob = new Blob([patched as BlobPart], { type: "application/octet-stream" });
    const dataUrl = URL.createObjectURL(blob);

    const a = <HTMLAnchorElement>document.getElementById('downloadButton');
    a.href = dataUrl;
    a.download = 'eeprom.bin';
    a.click();

  } catch (err: any) {
    alert("Error: " + err.message);
  }
}

if (typeof window !== 'undefined') {
  window.patchCode = patchCode;
  window.populateMachines = populateMachines;
  populateMachines();
}