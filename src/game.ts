class SlotMachine {
    private symbols: string[];
    private wheelElements: HTMLElement[] = [];
    private spinButton: HTMLElement | null = null;

    constructor() {
        this.symbols = ['🍒', '🍋', '🍇', '🍉', '🍓', '🍌'];

        const wheel1 = document.getElementById('wheel1');
        const wheel2 = document.getElementById('wheel2');
        const wheel3 = document.getElementById('wheel3');

        const spinButton = document.getElementById('spinButton');
        if (spinButton) {
            this.spinButton = spinButton;
            this.spinButton.addEventListener('click', () => this.spin());
        } else {
            console.error("Spin button element not found");
        }
    }

    private getRandomSymbol(): string {
        const index = Math.floor(Math.random() * this.symbols.length);
        return this.symbols[index];
    }

    spin() {
        this.wheelElements.forEach(wheel => {
            // Generate 3 end symbols, 9 random symbols for animation and leave alone the previous 3 symbols
            
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new SlotMachine();
});
