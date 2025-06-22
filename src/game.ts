class SlotMachine {
    private symbols: { char: string; value: number }[] = [
        { char: '🍒', value: 10 }, // Cherry
        { char: '🍋', value: 20 }, // Lemon
        { char: '🍇', value: 30 }, // Grapes
        { char: '🍉', value: 40 }, // Watermelon
        { char: '🍓', value: 50 }, // Strawberry
        { char: '🍌', value: 60 }  // Banana
    ];
    private wheelElements: HTMLElement[] = [];
    private spinButton: HTMLElement | null = null;
    private scoreLabel: HTMLElement | null = null;
    private score: number = 0;
    private wheelLength: number = 30;
    private symbolsVisible: number = 3;

    constructor() {
        const wheels = ['wheel1', 'wheel2', 'wheel3'].map(id => document.getElementById(id));
        this.wheelElements.push(...(wheels.filter((el): el is HTMLElement => el !== null)));

        const spinButton = document.getElementById('spinButton');
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
            wheel.style.transition = 'transform 3s ease-in-out';
            wheel.style.transform = `translateY(-${(this.wheelLength - this.symbolsVisible) * 150}px)`;

            // Reset the transform after the animation to allow infinite spin
            setTimeout(() => {
                for (let i = 0; i < this.symbolsVisible; i++) {
                    (symbolElements[i] as HTMLElement).textContent = (symbolElements[(this.wheelLength - this.symbolsVisible)+i] as HTMLElement).textContent;
                }

                wheel.style.transition = 'none';
                (wheel as HTMLElement).style.transform = `translateY(0)`;
            }, 3000);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new SlotMachine();
});