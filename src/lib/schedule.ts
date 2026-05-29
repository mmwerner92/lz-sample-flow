export type Frequency = "One-Time" | "Daily" | "Weekly" | "Bi-Weekly" | "Monthly";
export const FREQUENCIES: Frequency[] = ["One-Time", "Daily", "Weekly", "Bi-Weekly", "Monthly"];


export type SampleStatus = "Open" | "Closed" | "Lab" | "Dispose";
export const SAMPLE_STATUSES: SampleStatus[] = ["Open", "Closed", "Lab", "Dispose"];

/**
 * Compute the next trigger timestamp (ISO) for a schedule.
 * `time` is HH:MM (24h). Result is the next occurrence at that local time
 * that is >= `from` (default now), shifted by frequency.
 */
export function computeNextTrigger(
  timeOfDay: string,
  frequency: Frequency,
  from: Date = new Date(),
  lastTrigger?: Date | null,
): Date {
  const [hh, mm] = timeOfDay.split(":").map(Number);
  const base = lastTrigger ? new Date(lastTrigger) : new Date(from);
  const next = new Date(base);
  next.setHours(hh ?? 0, mm ?? 0, 0, 0);

  if (lastTrigger) {
    switch (frequency) {
      case "Weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "Bi-Weekly":
        next.setDate(next.getDate() + 14);
        break;
      case "Monthly":
        next.setMonth(next.getMonth() + 1);
        break;
      case "One-Time":
        return next;
    }
    return next;
  }

  // No prior trigger — first occurrence at/after `from`
  if (next <= from) {
    switch (frequency) {
      case "One-Time":
      case "Weekly":
      case "Bi-Weekly":
        next.setDate(next.getDate() + 1);
        break;
      case "Monthly":
        next.setDate(next.getDate() + 1);
        break;
    }
  }
  return next;
}

export function formatNextTrigger(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}
