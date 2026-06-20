const sectorDisplayMap: Record<string, string> = {
  'خودرو و ساخت قطعات': 'خودرویی‌ها',
  'فلزات اساسی': 'فلزات',
  'انبوه‌سازی، املاک و مستغلات': 'مسکن و ساختمان',
  'محصولات شیمیایی': 'شیمیایی‌ها',
  'فرآورده‌های نفتی، کک و سوخت هسته‌ای': 'پالایشی‌ها',
  'بانک‌ها و مؤسسات اعتباری': 'بانکی‌ها',
  'سیمان، آهک و گچ': 'سیمانی‌ها',
  'کانه‌های فلزی': 'معدنی‌ها',
  'سرمایه‌گذاری‌ها': 'سرمایه‌گذاری‌ها',
  'غذایی و آشامیدنی به جز قند و شکر': 'غذایی‌ها'
};

export const getDisplaySector = (sectorName?: string | null): string | null => {
  if (!sectorName) {
    return null;
  }

  return sectorDisplayMap[sectorName] ?? sectorName;
};

export const slugifySectorName = (sectorName: string): string => {
  return sectorName
    .trim()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^\p{L}\p{N}-]+/gu, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
};
