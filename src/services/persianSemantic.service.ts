import type {
  AnalysisConfidence,
  AnalysisRegime,
  BuyTimeframes,
  CompositeSignal,
  StochRsiAnalysis
} from '../types';

const DISCLAIMER =
  'این تحلیل صرفاً خروجی یک سیستم تحلیلی است و توصیه خرید یا فروش محسوب نمی‌شود.';

const baseMessageByRegime: Record<AnalysisRegime, string> = {
  STRONG_BULLISH_LIQUIDITY:
    'وضعیت ارزش معاملات نماد {symbol} نشان‌دهنده ورود قوی‌تر نقدینگی است. میانگین کوتاه‌مدت بالاتر از میانگین ماهانه و فصلی قرار دارد و شیب میانگین ماهانه نیز مثبت است؛ بنابراین از منظر ارزش معاملات، روند نقدینگی سهم صعودی ارزیابی می‌شود.',
  EARLY_BULLISH:
    'میانگین هفتگی ارزش معاملات {symbol} به بالای میانگین ماهانه رسیده است. این موضوع می‌تواند نشانه شروع بهبود کوتاه‌مدت در توجه بازار به سهم باشد، اما هنوز برای تأیید میان‌مدت نیاز است میانگین ماهانه نیز نسبت به میانگین فصلی تقویت شود.',
  CONFIRMED_BULLISH:
    'کراس رو به بالای میانگین ماهانه نسبت به میانگین فصلی در {symbol} رخ داده است. این وضعیت معمولاً نشانه تأیید میان‌مدت ورود نقدینگی است، به‌ویژه اگر قیمت نیز هم‌زمان روند صعودی داشته باشد.',
  SHORT_TERM_WARNING:
    'میانگین هفتگی ارزش معاملات {symbol} به زیر میانگین ماهانه رفته است. این وضعیت می‌تواند نشانه کاهش مومنتوم کوتاه‌مدت نقدینگی باشد. اگر قیمت نیز ضعف نشان دهد، باید نسبت به ادامه روند صعودی محتاط‌تر بود.',
  BEARISH_LIQUIDITY:
    'ساختار میانگین‌های ارزش معاملات {symbol} نزولی است. میانگین کوتاه‌مدت پایین‌تر از میانگین‌های بلندتر قرار دارد و شیب میانگین ماهانه نیز منفی است؛ بنابراین مشارکت و نقدینگی سهم ضعیف ارزیابی می‌شود.',
  NEUTRAL:
    'وضعیت ارزش معاملات {symbol} سیگنال واضحی از ورود یا خروج قدرتمند نقدینگی نشان نمی‌دهد. ساختار میانگین‌ها ترکیبی است و بهتر است تحلیل با روند قیمت، مقاومت‌ها، حمایت‌ها و وضعیت کلی بازار ترکیب شود.'
};

const compositeMessageByAction: Record<CompositeSignal['action'], string> = {
  STRONG_BUY:
    'جمع‌بندی سیستم: شرایط خرید قوی از نظر نقدینگی و مومنتوم فعال است.',
  PROBABLE_BUY:
    'جمع‌بندی سیستم: شرایط خرید احتمالی فعال است، اما نیاز به مدیریت ریسک دارد.',
  HOLD: 'جمع‌بندی سیستم: نگهداری/ادامه همراهی با روند، بدون سیگنال تازه خرید یا فروش.',
  CAUTION:
    'جمع‌بندی سیستم: احتیاط؛ نشانه‌هایی از ضعف یا ریسک کوتاه‌مدت دیده می‌شود.',
  RISK_SELL: 'جمع‌بندی سیستم: هشدار فروش/کاهش ریسک فعال شده است.',
  CONFIRMED_SELL: 'جمع‌بندی سیستم: سیگنال خروج یا کاهش جدی ریسک تأیید شده است.'
};

export const generateBuyTimeframePersianSummary = (
  buy: BuyTimeframes
): string => {
  const active: string[] = [];

  if (buy.shortTerm) active.push('کوتاه‌مدت');
  if (buy.midTerm) active.push('میان‌مدت');
  if (buy.longTerm) active.push('بلندمدت');

  if (active.length === 0) {
    return 'در حال حاضر هیچ‌کدام از شروط خرید مبتنی بر ارزش معاملات فعال نیست.';
  }

  return `شرط‌های خرید مبتنی بر ارزش معاملات در بازه‌های ${active.join('، ')} فعال است.`;
};

const generateStochRsiPersianSummary = (
  stochRsi?: StochRsiAnalysis
): string | null => {
  if (!stochRsi || stochRsi.status === 'INSUFFICIENT_DATA') {
    return 'برای محاسبه Stoch RSI داده کافی در دسترس نیست.';
  }

  if (stochRsi.confirmedSell) {
    return 'با خروج نزولی Stoch RSI از ناحیه قرمز، ریسک اصلاح یا کاهش مومنتوم افزایش یافته است.';
  }

  if (stochRsi.riskSell) {
    return 'در اندیکاتور Stoch RSI، کراس نزولی در ناحیه قرمز مشاهده شده و به‌عنوان هشدار احتیاط در نظر گرفته می‌شود.';
  }

  if (stochRsi.probableBuy) {
    return 'در اندیکاتور Stoch RSI، کراس رو به بالا در ناحیه سبز مشاهده شده که می‌تواند نشانه شروع بهبود مومنتوم باشد.';
  }

  return null;
};

export const buildPersianSummary = (
  symbol: string,
  regime: AnalysisRegime,
  confidence?: AnalysisConfidence,
  buy?: BuyTimeframes,
  stochRsi?: StochRsiAnalysis,
  composite?: CompositeSignal
): string => {
  const message = baseMessageByRegime[regime].replace('{symbol}', symbol);
  const parts = [message];

  if (confidence) {
    parts.push(`سطح اطمینان این جمع‌بندی ${confidence} ارزیابی می‌شود.`);
  }

  if (buy) {
    parts.push(generateBuyTimeframePersianSummary(buy));
  }

  const stochRsiMessage = generateStochRsiPersianSummary(stochRsi);
  if (stochRsiMessage) {
    parts.push(stochRsiMessage);
  }

  if (composite) {
    parts.push(compositeMessageByAction[composite.action]);
  }

  parts.push(DISCLAIMER);

  return parts.join(' ');
};

export const analysisDisclaimer = DISCLAIMER;
