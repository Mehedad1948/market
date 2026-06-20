import type {
  AdxAnalysis,
  AnalysisConfidence,
  AnalysisRegime,
  AtrAnalysis,
  BuyTimeframes,
  CompositeSignal,
  LiquidityConfirmation,
  PriceTrendAnalysis,
  StochRsiAnalysis,
  TimeframeComposite
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
    'جمع‌بندی سیستم: شرایط خرید قوی از نظر نقدینگی، مومنتوم و روند قیمت فعال است.',
  PROBABLE_BUY:
    'جمع‌بندی سیستم: شرایط خرید احتمالی فعال است، اما برای ورود باید مدیریت ریسک و حد ضرر رعایت شود.',
  HOLD: 'جمع‌بندی سیستم: وضعیت فعلی بیشتر مناسب نگهداری یا نظارت است و سیگنال قوی جدید برای ورود یا خروج دیده نمی‌شود.',
  CAUTION:
    'جمع‌بندی سیستم: احتیاط؛ برخی نشانه‌های ضعف یا ریسک کوتاه‌مدت مشاهده می‌شود.',
  RISK_SELL:
    'جمع‌بندی سیستم: هشدار کاهش ریسک فعال شده است و بهتر است رفتار قیمت و خروج نقدینگی با دقت بررسی شود.',
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

const generatePriceTrendPersianSummary = (
  priceTrend?: PriceTrendAnalysis
): string | null => {
  if (!priceTrend || priceTrend.status === 'INSUFFICIENT_DATA') {
    return 'برای ارزیابی روند قیمت، داده کافی در دسترس نیست.';
  }

  if (priceTrend.direction === 'BULLISH') {
    return 'روند قیمت نیز صعودی ارزیابی می‌شود؛ قیمت بالاتر از میانگین‌های مهم قرار دارد و ساختار میانگین‌ها مثبت است.';
  }

  if (priceTrend.direction === 'IMPROVING') {
    return 'روند قیمت در حال بهبود است، اما هنوز تأیید کامل صعودی از نظر ساختار میانگین‌ها شکل نگرفته است.';
  }

  if (priceTrend.direction === 'WEAKENING') {
    return 'در روند قیمت نشانه‌هایی از ضعف کوتاه‌مدت دیده می‌شود و قیمت نسبت به میانگین کوتاه‌مدت حساس شده است.';
  }

  if (priceTrend.direction === 'BEARISH') {
    return 'روند قیمت نزولی ارزیابی می‌شود و قیمت پایین‌تر از میانگین‌های مهم قرار دارد.';
  }

  return null;
};

const generateCompositePersianSummary = (
  composite?: CompositeSignal
): string | null => {
  if (!composite) {
    return null;
  }

  if (composite.explanationKey === 'composite.confirmedSellButTrendStrong') {
    return 'در Stoch RSI هشدار خروج دیده می‌شود، اما چون روند اصلی و نقدینگی هنوز کاملاً تضعیف نشده‌اند، این وضعیت بیشتر به‌عنوان احتیاط و مدیریت ریسک در نظر گرفته می‌شود، نه الزاماً خروج کامل.';
  }

  return compositeMessageByAction[composite.action];
};

const generateHorizonSummary = (
  horizon: 'کوتاه‌مدت' | 'میان‌مدت' | 'بلندمدت',
  timeframe: TimeframeComposite
): string => {
  if (horizon === 'کوتاه‌مدت') {
    if (timeframe.action === 'BUY') {
      return 'جمع‌بندی کوتاه‌مدت: شرایط ورود کوتاه‌مدت آماده و مومنتوم خرید فعال است.';
    }

    if (timeframe.action === 'PROBABLE_BUY') {
      return 'جمع‌بندی کوتاه‌مدت: نشانه‌های ورود کوتاه‌مدت دیده می‌شود، اما هنوز بهتر است با تایید بیشتر اقدام شود.';
    }

    if (timeframe.action === 'CAUTION') {
      return 'جمع‌بندی کوتاه‌مدت: ریسک نوسان یا هشدار کوتاه‌مدت دیده می‌شود و باید با احتیاط عمل کرد.';
    }

    if (timeframe.action === 'REDUCE' || timeframe.action === 'EXIT') {
      return 'جمع‌بندی کوتاه‌مدت: فشار خروج کوتاه‌مدت فعال شده و کاهش موقعیت یا خروج قابل بررسی است.';
    }

    if (timeframe.action === 'HOLD') {
      return 'جمع‌بندی کوتاه‌مدت: وضعیت کوتاه‌مدت بد نیست، اما هنوز سیگنال ورود تازه و قوی دیده نمی‌شود.';
    }

    return 'جمع‌بندی کوتاه‌مدت: سیگنال ورود تازه فعال نیست و بهتر است برای اصلاح یا کراس مناسب‌تر صبر شود.';
  }

  if (horizon === 'میان‌مدت') {
    if (timeframe.action === 'BUY') {
      return 'جمع‌بندی میان‌مدت: روند و نقدینگی برای ورود میان‌مدت مناسب ارزیابی می‌شود.';
    }

    if (timeframe.action === 'PROBABLE_BUY' || timeframe.action === 'HOLD') {
      return timeframe.quality === 'STRONG_BULLISH' ||
        timeframe.quality === 'BULLISH'
        ? 'جمع‌بندی میان‌مدت: وضعیت روند و نقدینگی مثبت است و نگهداری سهم قابل قبول ارزیابی می‌شود.'
        : 'جمع‌بندی میان‌مدت: وضعیت میان‌مدت قابل قبول است، اما هنوز کیفیت روند برای ورود پرقدرت کامل نیست.';
    }

    if (timeframe.action === 'CAUTION') {
      return 'جمع‌بندی میان‌مدت: برخی هشدارهای روند یا مومنتوم دیده می‌شود و بهتر است محتاطانه پیگیری شود.';
    }

    if (timeframe.action === 'REDUCE' || timeframe.action === 'EXIT') {
      return 'جمع‌بندی میان‌مدت: کیفیت نگهداری میان‌مدت تضعیف شده و کاهش موقعیت یا خروج باید بررسی شود.';
    }

    return 'جمع‌بندی میان‌مدت: هنوز شواهد کافی برای ورود یا نگهداری قوی میان‌مدت دیده نمی‌شود.';
  }

  if (timeframe.action === 'BUY') {
    return 'جمع‌بندی بلندمدت: ساختار کلی سهم صعودی و مناسب نگهداری یا اضافه‌کردن موقعیت ارزیابی می‌شود.';
  }

  if (timeframe.action === 'PROBABLE_BUY' || timeframe.action === 'HOLD') {
    return timeframe.quality === 'STRONG_BULLISH'
      ? 'جمع‌بندی بلندمدت: ساختار کلی سهم همچنان صعودی و قدرتمند است.'
      : 'جمع‌بندی بلندمدت: ساختار بلندمدت سهم هنوز مثبت است و نگهداری آن قابل دفاع ارزیابی می‌شود.';
  }

  if (timeframe.action === 'CAUTION') {
    return 'جمع‌بندی بلندمدت: روند اصلی هنوز کاملا تخریب نشده، اما نشانه‌هایی از احتیاط در افق بلندمدت دیده می‌شود.';
  }

  if (timeframe.action === 'REDUCE' || timeframe.action === 'EXIT') {
    return 'جمع‌بندی بلندمدت: ساختار روند بلندمدت تضعیف شده و نگهداری پرریسک‌تر شده است.';
  }

  return 'جمع‌بندی بلندمدت: هنوز کیفیت کافی برای تصمیم‌گیری مثبت بلندمدت دیده نمی‌شود.';
};

const generateCompositeHorizonSummaries = (
  composite?: CompositeSignal
): string[] => {
  if (!composite) {
    return [];
  }

  return [
    generateHorizonSummary('کوتاه‌مدت', composite.timeframes.shortTerm),
    generateHorizonSummary('میان‌مدت', composite.timeframes.midTerm),
    generateHorizonSummary('بلندمدت', composite.timeframes.longTerm)
  ];
};

const generateAdxPersianSummary = (adx?: AdxAnalysis): string | null => {
  if (!adx || adx.status === 'INSUFFICIENT_DATA') {
    return null;
  }

  if (adx.trendStrength === 'WEAK') {
    return 'قدرت روند در ADX ضعیف است و بهتر است سیگنال ها با احتیاط بیشتری تفسیر شوند.';
  }

  if (adx.trendStrength === 'STRONG' && adx.bearishDirectionalBias) {
    return 'ADX از روند قوی خبر می دهد، اما برتری جهت دار فعلا بیشتر نزولی است.';
  }

  if (adx.trendStrength === 'STRONG' && adx.bullishDirectionalBias) {
    return 'ADX روند را قوی نشان می دهد و برتری جهت دار فعلا به نفع حرکت صعودی است.';
  }

  return null;
};

const generateAtrPersianSummary = (atr?: AtrAnalysis): string | null => {
  if (!atr || atr.status === 'INSUFFICIENT_DATA') {
    return null;
  }

  if (atr.volatilityRegime === 'HIGH') {
    return 'ATR بالا نشان می دهد نوسان زیاد است و مدیریت ریسک و فاصله حد ضرر اهمیت بیشتری دارد.';
  }

  return null;
};

const generateLiquidityConfirmationSummary = (
  liquidityConfirmation?: LiquidityConfirmation
): string | null => {
  if (
    !liquidityConfirmation ||
    liquidityConfirmation.relativeTradeValue20 === null
  ) {
    return null;
  }

  if (liquidityConfirmation.liquidityExpansion) {
    return 'ارزش معاملات روز آخر نسبت به میانگین 20 روزه تقویت شده است.';
  }

  if (liquidityConfirmation.liquidityContraction) {
    return 'ارزش معاملات روز آخر نسبت به میانگین 20 روزه کاهش یافته است.';
  }

  return null;
};

export const buildPersianSummary = (
  symbol: string,
  regime: AnalysisRegime,
  confidence?: AnalysisConfidence,
  buy?: BuyTimeframes,
  stochRsi?: StochRsiAnalysis,
  composite?: CompositeSignal,
  priceTrend?: PriceTrendAnalysis,
  adx?: AdxAnalysis,
  atr?: AtrAnalysis,
  liquidityConfirmation?: LiquidityConfirmation
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

  const priceTrendMessage = generatePriceTrendPersianSummary(priceTrend);
  if (priceTrendMessage) {
    parts.push(priceTrendMessage);
  }

  const compositeMessage = generateCompositePersianSummary(composite);
  if (compositeMessage) {
    parts.push(compositeMessage);
  }

  parts.push(...generateCompositeHorizonSummaries(composite));

  const adxMessage = generateAdxPersianSummary(adx);
  if (adxMessage) {
    parts.push(adxMessage);
  }

  const atrMessage = generateAtrPersianSummary(atr);
  if (atrMessage) {
    parts.push(atrMessage);
  }

  const liquidityMessage = generateLiquidityConfirmationSummary(
    liquidityConfirmation
  );
  if (liquidityMessage) {
    parts.push(liquidityMessage);
  }

  parts.push(DISCLAIMER);

  return parts.join(' ');
};

export const analysisDisclaimer = DISCLAIMER;
