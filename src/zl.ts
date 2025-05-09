type ZlData = {
    zlNr: number;
    code: number;
};

function blockAlgorithm(data: number[], dataArray: number[]): void {
    for (let i = 0; i < 12; ++i) {
        data[i] = (dataArray[i] + data[i]) % 10;
    }

    for (let j = 0; j <= 5; ++j) {
        for (let k = 0; k <= 11; k += 3) {
            const v9 = 100 * data[k] + 10 * data[k + 1] + data[k + 2];
            const v10 = ((481 * v9 + 117) % 1000) & 0xFFFF;

            data[k + 0] = Math.floor(v10 / 100);
            data[k + 1] = Math.floor((v10 % 100) / 10);
            data[k + 2] = v10 % 10;
        }

        const tmp = data[11];

        for (let k = 0; k <= 10; ++k) {
            data[11 - k] = data[10 - k];
        }

        data[0] = tmp;
    }
}

function generateChecksum(data: number[]): number {
    const v7 = 1000 * data[0] + 100 * data[1] + 10 * data[2] + data[3];
    const v8 = 1000 * data[4] + 100 * data[5] + 10 * data[6] + data[7];
    const v9 = 1000 * data[8] + 100 * data[9] + 10 * data[10] + data[11];

    return (v9 + v8 + v7) % 10000;
}

function generateZlCode(data: number[], firstArray: number[], secondArray: number[]): number {
    blockAlgorithm(data, firstArray);
    blockAlgorithm(data, secondArray);

    return generateChecksum(data);
}

function generateZlCodeV2(data: number[]): number {
    const v3 = [4, 1, 1, 8, 2, 2, 1, 5, 9, 8, 1, 0];
    const v2 = [5, 2, 5, 7, 3, 7, 0, 2, 5, 8, 0, 6];

    return generateZlCode(data, v3, v2);
}

function generateZlCodeV3(data: number[]): number {
    const v3 = [7, 2, 1, 1, 4, 9, 8, 4, 3, 8, 6, 1];
    const v2 = [3, 1, 8, 3, 2, 0, 5, 6, 2, 7, 0, 5];

    return generateZlCode(data, v3, v2);
}

function nthDig(n: number, k: number): number {
    while (n--) {
        k = Math.floor(k / 10);
    }
    return k % 10;
}

function convertZlDataToArray(zlData: ZlData, zlnr: number[], code: number[]): void {
    const tmpZlnr = [
        nthDig(8, zlData.zlNr),
        nthDig(7, zlData.zlNr),
        nthDig(6, zlData.zlNr),
        nthDig(5, zlData.zlNr),
        nthDig(4, zlData.zlNr),
        nthDig(3, zlData.zlNr),
        nthDig(2, zlData.zlNr),
        nthDig(1, zlData.zlNr),
        nthDig(0, zlData.zlNr),
        nthDig(7, zlData.code),
        nthDig(6, zlData.code),
        nthDig(5, zlData.code),
        nthDig(4, zlData.code)
    ];

    for (let i = 0; i < 13; i++) {
        zlnr[i] = tmpZlnr[i];
    }

    code[0] = nthDig(0, zlData.code) + (nthDig(1, zlData.code) * 10) + (nthDig(2, zlData.code) * 100) + (nthDig(3, zlData.code) * 1000);
}
