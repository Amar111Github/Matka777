
// Calculate the final game result based on two input numbers.
export function calculateGameFinalResult(number1, number2) {
    // Calculate the sum of the digits for each input number.
    const sum1 = calculateDigitSum(number1);
    const sum2 = calculateDigitSum(number2);

    // Get the last two digits of the sum for each input number.
    const lastTwoDigits1 = getLastDigit(sum1);
    const lastTwoDigits2 = getLastDigit(sum2);

    // Combine the last two digits of both sums to form a new number.
    const combinedNumber = (lastTwoDigits1 * 10) + lastTwoDigits2;

    // Print intermediate results (assuming kDebugMode is a constant or variable defined earlier).
    // if (kDebugMode) {
        // console.log("Sum of digits for number 1:", sum1);
        // console.log("Sum of digits for number 2:", sum2);
        // console.log("Last two digits of sum 1:", lastTwoDigits1);
        // console.log("Last two digits of sum 2:", lastTwoDigits2);
        // console.log("Combined number:", combinedNumber);
    // }

    // Return the combined result as the final game result.
    return combinedNumber;
}

// Calculate the sum of the digits of a given number.
export function calculateDigitSum(number) {
    let sum = 0;

    // Iterate through each digit of the number and add it to the sum.
    while (number > 0) {
        sum += number % 10;
        number = Math.floor(number / 10);
    }

    // Return the calculated sum of digits.
    return sum;
}

// Get the last digit of a given number (the remainder when divided by 10).
export function getLastDigit(number) {
    return number % 10;
}


export function generateOTP() {
    // Generate a random 4-digit number
    const otp = Math.floor(1000 + Math.random() * 9000);
    return otp.toString(); // Convert to string to ensure it's always 4 digits
}



export function hasDuplicateDigitsInString(str) {
    // Convert the string to an array of characters
    let aStr = str.replace(/[^0-9]/g, '');
    let numericArray = aStr.split('');


    // Use a Set to check for duplicate digits
    let uniqueDigits = new Set(numericArray);

    // If the Set size is less than the array length, there are duplicates
    return uniqueDigits.size !== numericArray.length;
}


export function areAllElementsSameInString(str) {
    // Convert the string to an array of characters
    let aStr = str.replace(/[^0-9]/g, '');
    let charArray = aStr.split('');

    // console.log(aStr);
    // console.log(charArray);
    for (let i = 1; i < charArray.length; i++) {
        // Check if the current character is not equal to the first character
        if (charArray[i] !== charArray[0]) {
            // If true, the string contains different characters, return false
            return false;
        }
    }

    // If the loop completes without returning false, all characters are the same, return true
    return true;
}

export function areAllElementsDifferentInString(str) {
    // Convert the string to an array of characters
    let charArray = str.split('');

    for (let i = 0; i < charArray.length; i++) {
        for (let j = i + 1; j < charArray.length; j++) {
            if (charArray[i] === charArray[j]) {
                return false; // Found two equal characters, the string has duplicates
            }
        }
    }
    return true; // No two characters are equal, all characters are different
}
