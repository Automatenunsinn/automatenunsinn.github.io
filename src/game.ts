class SlotMachine {
    private symbols: string[] = ['🍒', '🍋', '🍇', '🍉', '🍓', '🍌'];
    private wheelElements: HTMLElement[] = [];
    private spinButton: HTMLElement | null = null;

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
    }

    private getRandomSymbol(): string {
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

            for (let i = 3; i < 15; i++) { // 3 end symbols + 9 random symbols to create spinning effect
                (symbolElements[i] as HTMLElement).textContent = this.getRandomSymbol();
            }

            // Animate the spinning effect using transform
            wheel.style.transition = 'transform 3s ease';
            wheel.style.transform = `translateY(-${(12) * 150}px)`;

            // Reset the transform after the animation to allow infinite spin
            setTimeout(() => {
                for (let i = 0; i < 3; i++) {
                    console.log((symbolElements[i] as HTMLElement).textContent);
                    console.log((symbolElements[12+i] as HTMLElement).textContent);
                    (symbolElements[i] as HTMLElement).textContent = (symbolElements[12+i] as HTMLElement).textContent;
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