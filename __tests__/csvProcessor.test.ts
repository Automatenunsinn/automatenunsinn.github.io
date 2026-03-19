import { splitBestellNr,splitTeileNr } from '../src/utils/csvProcessor';

test('Splitting order number', () => {
  // Define a number to split
  const input = "60001234";
   
  // Expected strings for the input
  const expectedString = ["6000","1234"];
   
  // Encode the input array
  const encodedString = splitBestellNr(input);
   
  // Check that the encoded string matches the expected value
  expect(encodedString).toEqual(expectedString);
}); 

test('Splitting invalid order number', () => {
  // Define a number to split
  const input = "6000234";
   
  // Expected strings for the input
  const expectedString = [null,null];
   
  // Encode the input array
  const encodedString = splitBestellNr(input);
   
  // Check that the encoded string matches the expected value
  expect(encodedString).toEqual(expectedString);
}); 

test('Splitting empty order number', () => {
  const input = "";
  const expected = [null,null];
  expect(splitBestellNr(input)).toEqual(expected);
});

test('Splitting part number', () => {
  // Define a number to split
  const input = "1557/0500007F";
   
  // Expected strings for the input
  const expectedString = ["1557","0500007","F"];
   
  // Encode the input array
  const encodedString = splitTeileNr(input);
   
  // Check that the encoded string matches the expected value
  expect(encodedString).toEqual(expectedString);
});

test('Splitting part number without slash', () => {
  const input = "1234567F";
  const expected = ["1234","567","F"];
  expect(splitTeileNr(input)).toEqual(expected);
});

test('Splitting empty part number', () => {
  const input = "";
  const expected = [null,null,null];
  expect(splitTeileNr(input)).toEqual(expected);
});

// Test for parts with slash before erweiterung (like 30070/000401/BN)
test('Splitting part number with two slashes', () => {
  const input = "30070/000401/BN";
  const expected = ["30070","000401","BN"];
  expect(splitTeileNr(input)).toEqual(expected);
});

// Test for parts with slash but empty erweiterung
test('Splitting part number with slash and empty erweiterung', () => {
  const input = "4542/";
  const expected = ["4542","",""];
  expect(splitTeileNr(input)).toEqual(expected);
});

test('Splitting part number with letters in nummer', () => {
  const input = "30070/00040A/BN";
  const expected = ["30070","00040A","BN"];
  expect(splitTeileNr(input)).toEqual(expected);
});

test('Splitting part number with numbers in erweiterung', () => {
  const input = "30070/000401/B2";
  const expected = ["30070","000401","B2"];
  expect(splitTeileNr(input)).toEqual(expected);
});