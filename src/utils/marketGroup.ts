import type { InstrumentType } from '../types/symbolCatalog';

export type MarketGroupKey =
  | 'bank'
  | 'chemical'
  | 'auto'
  | 'metals'
  | 'mining'
  | 'oil_products'
  | 'cement'
  | 'construction'
  | 'pharma'
  | 'insurance'
  | 'investment'
  | 'nonmetal_mineral'
  | 'food'
  | 'sugar'
  | 'agriculture'
  | 'tile'
  | 'metal_products'
  | 'machinery'
  | 'electrical_devices'
  | 'rubber'
  | 'computer'
  | 'transport'
  | 'contracting'
  | 'housing_facilities'
  | 'etf'
  | 'right'
  | 'bond'
  | 'other';

export type MarketGroupInfo = {
  key: MarketGroupKey;
  label: string;
  icon: string;
  sortOrder: number;
};

export const normalizePersianText = (value: string) =>
  value
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ');

export const MARKET_GROUPS: Array<MarketGroupInfo & { matchSectors: string[] }> = [
  {
    key: 'bank',
    label: 'بانکی',
    icon: 'bank',
    sortOrder: 10,
    matchSectors: ['بانک‌ها و موسسات اعتباری', 'بانکها و موسسات اعتباری']
  },
  {
    key: 'chemical',
    label: 'شیمیایی',
    icon: 'flask',
    sortOrder: 20,
    matchSectors: ['محصولات شیمیایی']
  },
  {
    key: 'auto',
    label: 'خودرویی',
    icon: 'car',
    sortOrder: 30,
    matchSectors: ['خودرو و ساخت قطعات']
  },
  {
    key: 'metals',
    label: 'فلزات',
    icon: 'beam',
    sortOrder: 40,
    matchSectors: ['فلزات اساسی']
  },
  {
    key: 'mining',
    label: 'استخراج فلزات',
    icon: 'pickaxe',
    sortOrder: 50,
    matchSectors: [
      'استخراج کانه‌های فلزی',
      'استخراج کانه های فلزی',
      'استخراج زغال سنگ',
      'استخراج سایر معادن'
    ]
  },
  {
    key: 'oil_products',
    label: 'فرآورده نفتی',
    icon: 'oil',
    sortOrder: 60,
    matchSectors: [
      'فرآورده‌های نفتی، کک و سوخت هسته‌ای',
      'فرآورده های نفتی، کک و سوخت هسته ای',
      'استخراج نفت گاز و خدمات جنبی جز اکتشاف'
    ]
  },
  {
    key: 'cement',
    label: 'سیمان',
    icon: 'cement',
    sortOrder: 70,
    matchSectors: ['سیمان، آهک و گچ']
  },
  {
    key: 'construction',
    label: 'ساختمان',
    icon: 'building',
    sortOrder: 80,
    matchSectors: ['انبوه‌سازی، املاک و مستغلات', 'انبوه سازی، املاک و مستغلات']
  },
  {
    key: 'pharma',
    label: 'دارویی',
    icon: 'medicine',
    sortOrder: 90,
    matchSectors: ['مواد و محصولات دارویی']
  },
  {
    key: 'insurance',
    label: 'بیمه',
    icon: 'shield',
    sortOrder: 100,
    matchSectors: ['بیمه و صندوق بازنشستگی به جز تامین اجتماعی']
  },
  {
    key: 'investment',
    label: 'سرمایه‌گذاری',
    icon: 'chart',
    sortOrder: 110,
    matchSectors: ['سرمایه‌گذاری‌ها', 'سرمایه گذاریها', 'شرکت‌های چند رشته‌ای صنعتی']
  },
  {
    key: 'nonmetal_mineral',
    label: 'کانی غیرفلزی',
    icon: 'diamond',
    sortOrder: 120,
    matchSectors: ['کانی غیرفلزی', 'محصولات کانی غیرفلزی']
  },
  {
    key: 'food',
    label: 'غذایی',
    icon: 'food',
    sortOrder: 130,
    matchSectors: ['محصولات غذایی و آشامیدنی به جز قند و شکر']
  },
  {
    key: 'sugar',
    label: 'قند',
    icon: 'sugar',
    sortOrder: 140,
    matchSectors: ['قند و شکر']
  },
  {
    key: 'agriculture',
    label: 'زراعت',
    icon: 'wheat',
    sortOrder: 150,
    matchSectors: ['زراعت و خدمات وابسته']
  },
  {
    key: 'tile',
    label: 'کاشی',
    icon: 'tile',
    sortOrder: 160,
    matchSectors: ['کاشی و سرامیک']
  },
  {
    key: 'metal_products',
    label: 'ساخت فلزی',
    icon: 'metal',
    sortOrder: 170,
    matchSectors: ['ساخت محصولات فلزی']
  },
  {
    key: 'machinery',
    label: 'ماشین‌آلات',
    icon: 'tools',
    sortOrder: 180,
    matchSectors: ['ماشین‌آلات و تجهیزات', 'ماشین آلات و تجهیزات']
  },
  {
    key: 'electrical_devices',
    label: 'دستگاه برقی',
    icon: 'plug',
    sortOrder: 190,
    matchSectors: ['ماشین‌آلات و دستگاه‌های برقی', 'ماشین آلات و دستگاه های برقی']
  },
  {
    key: 'rubber',
    label: 'لاستیک',
    icon: 'rubber',
    sortOrder: 200,
    matchSectors: ['لاستیک و پلاستیک']
  },
  {
    key: 'computer',
    label: 'رایانه',
    icon: 'computer',
    sortOrder: 210,
    matchSectors: [
      'رایانه و فعالیت‌های وابسته به آن',
      'رایانه و فعالیت های وابسته به آن',
      'اطلاعات و ارتباطات',
      'تولید محصولات کامپیوتری الکترونیکی و نوری'
    ]
  },
  {
    key: 'transport',
    label: 'حمل‌ونقل',
    icon: 'ship',
    sortOrder: 220,
    matchSectors: ['حمل و نقل، انبارداری و ارتباطات', 'حمل و نقل آبی']
  },
  {
    key: 'contracting',
    label: 'پیمانکاری',
    icon: 'tools',
    sortOrder: 230,
    matchSectors: ['پیمانکاری صنعتی', 'خدمات فنی و مهندسی']
  },
  {
    key: 'housing_facilities',
    label: 'تسهیلات مسکن',
    icon: 'home-clock',
    sortOrder: 240,
    matchSectors: ['اوراق تسهیلات مسکن']
  }
];

export const INSTRUMENT_MARKET_GROUPS: Record<
  'ETF' | 'RIGHT' | 'BOND' | 'UNKNOWN',
  MarketGroupInfo
> = {
  ETF: {
    key: 'etf',
    label: 'صندوق ETF',
    icon: 'fund',
    sortOrder: 900
  },
  RIGHT: {
    key: 'right',
    label: 'حق‌تقدم',
    icon: 'ticket',
    sortOrder: 910
  },
  BOND: {
    key: 'bond',
    label: 'اوراق',
    icon: 'bond',
    sortOrder: 920
  },
  UNKNOWN: {
    key: 'other',
    label: 'سایر',
    icon: 'more',
    sortOrder: 999
  }
};

export function resolveMarketGroup(input: {
  instrumentType: InstrumentType;
  sectorName?: string | null;
}): MarketGroupInfo {
  if (input.instrumentType !== 'STOCK') {
    return INSTRUMENT_MARKET_GROUPS[input.instrumentType] ?? INSTRUMENT_MARKET_GROUPS.UNKNOWN;
  }

  const sectorName = normalizePersianText(input.sectorName ?? '');

  for (const group of MARKET_GROUPS) {
    const matched = group.matchSectors.some(
      (sector) => normalizePersianText(sector) === sectorName
    );

    if (matched) {
      const { matchSectors: _matchSectors, ...info } = group;
      return info;
    }
  }

  return {
    key: 'other',
    label: 'سایر',
    icon: 'more',
    sortOrder: 999
  };
}

export function getBaseSymbolCode(code: string): string {
  return code.replace(/[0-9]+$/, '');
}

export function isDuplicateBoardSymbol(code: string, allCodes: Set<string>): boolean {
  const baseCode = getBaseSymbolCode(code);
  return baseCode !== code && allCodes.has(baseCode);
}
