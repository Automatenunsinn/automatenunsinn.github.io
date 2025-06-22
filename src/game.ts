import abCheck from './abCheck';

export class SlotMachine {
    private symbols: { char: string; value: number }[] = [
        { char: '🍒', value: 10 }, // Cherry
        { char: '🍋', value: 20 }, // Lemon
        { char: '🍇', value: 30 }, // Grapes
        { char: '🍉', value: 40 }, // Watermelon
        { char: '🍓', value: 50 }, // Strawberry
        { char: '🍌', value: 60 }  // Banana
    ];
    private wheelElements: HTMLElement[] = [];
    private spinButton: HTMLButtonElement | null = null;
    private scoreLabel: HTMLSpanElement | null = null;
    private score: number = 500;
    private cost: number = 5;
    private wheelLength: number = 30;
    private symbolsVisible: number = 3;
    private spinTime: number = 3;

    constructor() {
        const wheels = ['wheel1', 'wheel2', 'wheel3'].map(id => document.getElementById(id));
        this.wheelElements.push(...(wheels.filter((el): el is HTMLElement => el !== null)));

        const spinButton = <HTMLButtonElement>document.getElementById('spinButton');
        if (spinButton) {
            this.spinButton = spinButton;
            this.spinButton.addEventListener('click', () => this.spin());
        } else {
            console.error("Spin button element not found");
        }

        const scoreLabel = document.getElementById('scoreLabel');
        if (scoreLabel) {
            this.scoreLabel = scoreLabel;
        } else {
            console.error("Score label element not found");
        }
    }

    private getRandomSymbol(): { char: string; value: number } {
        const index = Math.floor(Math.random() * this.symbols.length);
        return this.symbols[index];
    }

    spin() {
        this.score -= this.cost;
        if (this.scoreLabel) {
            this.scoreLabel.textContent = `Score: ${this.score}`;
        }
        this.wheelElements.forEach(wheel => {
            const symbolElements = wheel.querySelectorAll('.symbol');

            if (!symbolElements || symbolElements.length === 0) {
                console.error("No symbol elements found");
                return;
            }

            for (let i = this.symbolsVisible; i < this.wheelLength; i++) { // 3 end symbols + 9 random symbols to create spinning effect
                const { char } = this.getRandomSymbol();
                (symbolElements[i] as HTMLElement).textContent = char;
            }

            // Animate the spinning effect using transform
            wheel.style.transition = 'transform ' + this.spinTime + 's ease-in-out';
            wheel.style.transform = `translateY(-${(this.wheelLength - this.symbolsVisible) * 150}px)`;

            // Reset the transform after the animation to allow infinite spin
            setTimeout(() => {
                for (let i = 0; i < this.symbolsVisible; i++) {
                    (symbolElements[i] as HTMLElement).textContent = (symbolElements[(this.wheelLength - this.symbolsVisible) + i] as HTMLElement).textContent;
                }

                wheel.style.transition = 'none';
                (wheel as HTMLElement).style.transform = `translateY(0)`;
            }, this.spinTime * 1000);
        });

        setTimeout(() => {
            let symbolsMatrix: string[][] = [];

            // Iterate through each row and collect the symbols from .symbol elements
            for (let i = 0; i < this.symbolsVisible; i++) {
                const rowSymbols = this.wheelElements.map(wheel =>
                    Array.from(wheel.childNodes)
                        .filter(node => node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('symbol'))
                    [i]?.textContent || ''
                );
                symbolsMatrix.push(rowSymbols);
            }

            this.score += this.calculateScore(symbolsMatrix);
            if (this.scoreLabel) {
                this.scoreLabel.textContent = `Score: ${this.score}`;
            }
        }, this.spinTime * 1000 + 10);

        if (this.spinButton)
            this.spinButton.disabled = true;

        setTimeout(() => {
            if (this.spinButton)
                if (abCheck()) this.spinButton.disabled = false;
        }, this.spinTime * 1000 + 20);
    }

    calculateScore(symbolsMatrix: string[][]): number {
        let score = 0;

        // Check horizontally for matches
        for (const row of symbolsMatrix) {
            const uniqueSymbols = [...new Set(row)];
            if (uniqueSymbols.length === 1 && row[0] !== '') { // All elements in the row are the same and not an empty string
                score += this.symbols.find(sym => sym.char === row[0])?.value || 0;
            }
        }

        // Check diagonally for matches (main diagonal)
        const mainDiagonal = symbolsMatrix.map((row, i) => row[i]);
        const uniqueMainDiagonalSymbols = [...new Set(mainDiagonal)];
        if (uniqueMainDiagonalSymbols.length === 1 && mainDiagonal[0] !== '') {
            score += this.symbols.find(sym => sym.char === mainDiagonal[0])?.value || 0;
        }

        // Check diagonally for matches (anti-diagonal)
        const antiDiagonal = symbolsMatrix.map((row, i) => row[symbolsMatrix.length - 1 - i]);
        const uniqueAntiDiagonalSymbols = [...new Set(antiDiagonal)];
        if (uniqueAntiDiagonalSymbols.length === 1 && antiDiagonal[0] !== '') {
            score += this.symbols.find(sym => sym.char === antiDiagonal[0])?.value || 0;
        }

        return score;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new SlotMachine();
});