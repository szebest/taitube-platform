import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'

/** Registering a locale twice is a no-op, so formatting stays free of import-time state. */
export function formatTimeAgo(date: Date | number): string {
	TimeAgo.addLocale(en)
	return new TimeAgo('en').format(date)
}
