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

test('Splitting empty order number', () => {
  const input = "";
  const expected = [null,null];
  expect(splitBestellNr(input)).toEqual(expected);
});

test('Splitting part number without slash', () => {
  const input = "1234567F";
  // Erwartetes Verhalten je nach Implementierung, hier als Beispiel:
  const expected = ["1234","567","F"];
  expect(splitTeileNr(input)).toEqual(expected);
});

test('Splitting empty part number', () => {
  const input = "";
  const expected = [null,null,null];
  expect(splitTeileNr(input)).toEqual(expected);
});