export const formatNumbers = (number: number, precision: number = 0): string => {
	if (number <= 0) return number.toString();

	const k = 1000;
	const sizes = ['', 'K', 'M', 'B', 'T', 'Q'];
	const i = Math.floor(Math.log(number) / Math.log(k));

	return `${parseFloat((number / Math.pow(k, i)).toFixed(precision))}${sizes[i]}`;
}