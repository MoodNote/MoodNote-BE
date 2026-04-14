/**
 * Returns a new Date set to midnight (00:00:00.000) local time on the given date.
 */
export function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Returns a new Date set to end of day (23:59:59.999) local time on the given date.
 */
export function endOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

/**
 * Returns a Date that is `n` full days before now.
 */
export function daysAgo(n: number): Date {
	return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * Counts consecutive days going backwards from today (UTC) for which
 * `predicate(dateStr)` returns true, where dateStr is "YYYY-MM-DD".
 */
export function countStreakFromToday(
	predicate: (dateStr: string) => boolean,
): number {
	let streak = 0;
	const cursor = new Date();
	cursor.setUTCHours(0, 0, 0, 0);
	while (true) {
		const dateStr = cursor.toISOString().split("T")[0];
		if (predicate(dateStr)) {
			streak++;
			cursor.setUTCDate(cursor.getUTCDate() - 1);
		} else {
			break;
		}
	}
	return streak;
}
