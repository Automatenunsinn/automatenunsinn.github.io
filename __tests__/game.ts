/**
 * @jest-environment jsdom
 */

import { SlotMachine } from '../src/game';

describe('calculateScore', () => {
    let slotMachine: SlotMachine;

    beforeEach(() => {
        slotMachine = new SlotMachine();
    });

    it('should calculate score for horizontal matches', () => {
        const symbolsMatrix: string[][] = [
            ['🍒', '🍒', '🍒'],
            ['🍋', '🍋', '🍋'],
            ['🍓', '🍓', '🍓']
        ];

        slotMachine.calculateScore(symbolsMatrix);

        expect(slotMachine.calculateScore(symbolsMatrix)).toBe(0); // 10 + 20 + 50
    });

    it('should calculate score for vertical non-matches', () => {
        const symbolsMatrix: string[][] = [
            ['🍒', '🍋', '🍓'],
            ['🍒', '🍋', '🍓'],
            ['🍒', '🍋', '🍓']
        ];

        slotMachine.calculateScore(symbolsMatrix);

        expect(slotMachine.calculateScore(symbolsMatrix)).toBe(0);
    });

    it('should calculate score for main diagonal matches', () => {
        const symbolsMatrix: string[][] = [
            ['🍒', '🍋', '🍓'],
            ['🍌', '🍒', '🍉'],
            ['🍇', '🍌', '🍒']
        ];

        slotMachine.calculateScore(symbolsMatrix);

        expect(slotMachine.calculateScore(symbolsMatrix)).toBe(10); // 10 for Cherry
    });

    it('should calculate score for anti-diagonal matches', () => {
        const symbolsMatrix: string[][] = [
            ['🍒', '🍋', '🍌'],
            ['🍓', '🍌', '🍉'],
            ['🍌', '🍇', '🍒']
        ];

        slotMachine.calculateScore(symbolsMatrix);

        expect(slotMachine.calculateScore(symbolsMatrix)).toBe(60 + 10); // 60 for Banana
    });

    it('should calculate duplicate scores for overlapping matches', () => {
        const symbolsMatrix: string[][] = [
            ['🍒', '🍋', '🍉'],
            ['🍓', '🍒', '🍉'],
            ['🍒', '🍒', '🍒']
        ];

        slotMachine.calculateScore(symbolsMatrix);
        expect(slotMachine.calculateScore(symbolsMatrix)).toBe(10 + 10); // 10 for Cherry twice
    });
});