const BIRTH_YEAR = 2002;
const BIRTH_MONTH_INDEX = 1;
const BIRTH_DAY = 18;

export function getBirthdayStats(now = new Date()) {
  let age = now.getFullYear() - BIRTH_YEAR;
  const birthdayThisYear = new Date(now.getFullYear(), BIRTH_MONTH_INDEX, BIRTH_DAY);

  if (now < birthdayThisYear) age -= 1;

  const nextBirthday = now < birthdayThisYear
    ? birthdayThisYear
    : new Date(now.getFullYear() + 1, BIRTH_MONTH_INDEX, BIRTH_DAY);

  const daysUntilBirthday = Math.ceil(
    (nextBirthday.getTime() - now.getTime()) / 86_400_000,
  );

  return { age, daysUntilBirthday };
}
