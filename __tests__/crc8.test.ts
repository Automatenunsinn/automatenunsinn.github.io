import { crc81wire } from 'crc';

// Helper function to match original implementation (initial value 255)
const calculateCrc8 = (data: Uint8Array): number => (crc81wire as any)(data, 255);

test('Crc8 calculation', () => {
  // Define a Uint8Array to encode
  const inputArray = new Uint8Array([247, 69, 132, 16, 18, 11, 30, 252, 75, 0, 0, 0, 0, 0, 0]);
  
  // Expected value
  const expected = 17; // Replace with the correct expected result based on your encoding logic
  
  // Encode the input array
  const calculated = calculateCrc8(inputArray);
  
  // Check that the encoded string matches the expected value
  expect(calculated).toBe(expected);
}); 



test('Crc8 check', () => {
    // Define a Uint8Array to encode
    const inputArray = new Uint8Array([252, 75, 247, 69, 132, 16, 182, 111, 9, 0, 18, 11, 30, 0, 0]);
  
    // Expected value
    const expected = 253; // Replace with the correct expected result based on your encoding logic
    
    // Encode the input array
    const calculated = calculateCrc8(inputArray);
    
    // Check that the encoded string matches the expected value
    expect(calculated).toBe(expected);
  }); 