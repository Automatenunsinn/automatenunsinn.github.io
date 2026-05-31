import { CustomBase32 } from '../src/base32';

test('Base32 encoding and decoding', () => {
  // Define a Uint8Array to encode
  const inputArray = new Uint8Array([218, 110, 219, 209, 167, 185, 219, 184, 46, 239, 230, 31, 228, 227, 189, 50]);
  
  // Encode the input array
  const encodedString = CustomBase32.base32Encode(inputArray);
  
  // Decode the encoded string
  const decodedArray = CustomBase32.base32Decode(encodedString);
  
  // Check that the decoded array matches the original input array
  expect(decodedArray).toEqual(inputArray);
});

test('Base32 encoding produces correct string', () => {
  // Define a Uint8Array to encode
  const inputArray = new Uint8Array([218, 110, 219, 209, 167, 185, 219, 184, 46, 239, 230, 31, 228, 227, 189, 50]);
  
  // Expected Base32 encoded string for the input array
  const expectedEncodedString = 'UQVQX9ZNTXQICRWX7Z89YIRRK2'; // Replace with the correct expected result based on your encoding logic
  
  // Encode the input array
  const encodedString = CustomBase32.base32Encode(inputArray);
  
  // Check that the encoded string matches the expected value
  expect(encodedString).toBe(expectedEncodedString);
}); 

test('Base32 decoding produces correct Uint8Array', () => {
  // Define a Base32 encoded string
  const encodedString = 'UQVQX-9ZNTX-QICRW-X7Z89-YIRRK2';
  
  // Expected Uint8Array for the encoded string
  const expectedArray = new Uint8Array([218, 110, 219, 209, 167, 185, 219, 184, 46, 239, 230, 31, 228, 227, 189, 50]);
  
  // Decode the encoded string
  const decodedArray = CustomBase32.base32Decode(encodedString);
  
  // Check that the decoded array matches the expected value
  expect(decodedArray).toEqual(expectedArray);
});

test('Base32 decoding produces correct reverse Uint8Array', () => {
  // Define a Base32 encoded string
  const encodedString = '1E288-GX155-WUE7P-QAV4W-NEGN95';

  // Expected Uint8Array for the encoded string
  const expectedArray = new Uint8Array([160, 133, 115, 94, 7, 132, 112, 221, 76, 181, 105, 15, 78, 219, 163, 136]);

  // Decode the encoded string
  const decodedArray = CustomBase32.base32Decode(encodedString);

  // Check that the decoded array matches the expected value
  expect(decodedArray).toEqual(expectedArray);
});

test('Base32 decoding normalizes every lowercase "l" to "1", not just the first', () => {
  // Regression: base32Decode used String.replace with a string argument, which
  // only replaces the first occurrence. A code containing more than one "l"
  // therefore threw "Invalid character: L" instead of decoding.
  expect(() => CustomBase32.base32Decode('llll')).not.toThrow();
  expect(CustomBase32.base32Decode('llll')).toEqual(CustomBase32.base32Decode('1111'));
});

test('Base32 decoding normalizes interleaved lowercase "l" characters', () => {
  expect(CustomBase32.base32Decode('l1l1')).toEqual(CustomBase32.base32Decode('1111'));
});

test('Base32 rejects "O" and "0" with a truthful error (they are not in the alphabet)', () => {
  // The alphabet is [1-9A-Z] minus J, L, O and has no '0'. Neither character is
  // valid, so a typed 'O' must report 'O' rather than being rewritten to '0'.
  expect(() => CustomBase32.base32Decode('O')).toThrow('Invalid character: O');
  expect(() => CustomBase32.base32Decode('0')).toThrow('Invalid character: 0');
});