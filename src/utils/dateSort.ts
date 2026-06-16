const jalaliDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (date: string): string => {
  const trimmed = date.trim();
  return jalaliDatePattern.test(trimmed) ? trimmed : trimmed;
};

export const compareDateStrings = (left: string, right: string): number => {
  const normalizedLeft = normalizeDate(left);
  const normalizedRight = normalizeDate(right);

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  return 0;
};

export const sortByDateAsc = <T extends { date: string }>(rows: T[]): T[] => {
  return [...rows].sort((a, b) => compareDateStrings(a.date, b.date));
};
