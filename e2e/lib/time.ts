// Dates for the browser's local time zone (the harness runs browser and
// Node in the same zone), in the formats the app's inputs expect.
export function daysFromNow(days: number, hour = 15, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function hoursFromNow(hours: number): Date {
  const d = new Date(Date.now() + hours * 3_600_000);
  d.setSeconds(0, 0);
  return d;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const datetimeLocalInput = (d: Date) => `${dateInput(d)}T${timeInput(d)}`;

/** "3:00 PM", as date-fns "h:mm a" renders it. */
export function clock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}
