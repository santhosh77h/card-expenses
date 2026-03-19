import * as Notifications from 'expo-notifications';
import type { CreditCard } from '../store';

// ---------------------------------------------------------------------------
// Setup - call once at app startup
// ---------------------------------------------------------------------------

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// Identifier helpers - deterministic IDs so we can cancel & replace
// ---------------------------------------------------------------------------

function cardReminderId(cardId: string) {
  return `card-reminder-${cardId}`;
}

const GLOBAL_REMINDER_ID = 'global-statement-reminder';

// ---------------------------------------------------------------------------
// Schedule per-card reminder (monthly on a given day at 9 AM)
// ---------------------------------------------------------------------------

export async function scheduleCardReminder(
  card: CreditCard,
  day: number,
): Promise<void> {
  const id = cardReminderId(card.id);

  // Cancel existing first
  await cancelById(id);

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: 'Statement Reminder',
      body: `Time to upload your ${card.nickname} (••${card.last4}) statement.`,
      sound: true,
    },
    trigger: {
      day,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Cancel per-card reminder
// ---------------------------------------------------------------------------

export async function cancelCardReminder(cardId: string): Promise<void> {
  await cancelById(cardReminderId(cardId));
}

// ---------------------------------------------------------------------------
// Schedule global reminder (all cards, monthly on a given day at 9 AM)
// ---------------------------------------------------------------------------

export async function scheduleGlobalReminder(day: number): Promise<void> {
  await cancelById(GLOBAL_REMINDER_ID);

  await Notifications.scheduleNotificationAsync({
    identifier: GLOBAL_REMINDER_ID,
    content: {
      title: 'Statement Reminder',
      body: 'Time to upload your credit card statements.',
      sound: true,
    },
    trigger: {
      day,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Cancel global reminder
// ---------------------------------------------------------------------------

export async function cancelGlobalReminder(): Promise<void> {
  await cancelById(GLOBAL_REMINDER_ID);
}

// ---------------------------------------------------------------------------
// Reschedule all - call on app start / after preference changes
// ---------------------------------------------------------------------------

export async function rescheduleAll(
  cards: CreditCard[],
  globalReminderDay: number | null,
): Promise<void> {
  // Cancel everything first
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Per-card reminders
  for (const card of cards) {
    if (card.reminderDay) {
      await scheduleCardReminder(card, card.reminderDay);
    }
  }

  // Global reminder
  if (globalReminderDay) {
    await scheduleGlobalReminder(globalReminderDay);
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function cancelById(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Notification may not exist - that's fine
  }
}
