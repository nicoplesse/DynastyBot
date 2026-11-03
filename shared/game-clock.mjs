// In-game clock of the Dynasty Realism server: one real hour is one game day, and every full real
// hour starts the game day at 06:00 (xx:15 = noon, xx:30 = 18:00, xx:45 = midnight). One real
// minute is 24 game minutes.

export const GAME_DAY_MINUTES = 60;
export const GAME_HOUR_AT_FULL_HOUR = 6;

// Game time (0–24 h) for a real moment.
export function gameHour(date) {
  const minutes = date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
  return (GAME_HOUR_AT_FULL_HOUR + (minutes * 24) / GAME_DAY_MINUTES) % 24;
}

// The next real moment at which the game clock shows `hour`.
export function realTimeOf(hour, date) {
  const ahead = (((hour - gameHour(date)) % 24) + 24) % 24;
  return new Date(date.getTime() + (ahead * GAME_DAY_MINUTES * 60000) / 24);
}
