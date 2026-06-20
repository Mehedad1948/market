import type { BrsAllSymbolItem, InstrumentType } from '../types/symbolCatalog';

export const classifyInstrument = (item: BrsAllSymbolItem): InstrumentType => {
  const symbol = item.l18?.trim() ?? '';
  const name = item.l30?.trim() ?? '';
  const sector = item.cs?.trim() ?? '';

  if (symbol.endsWith('ح')) {
    return 'RIGHT';
  }

  if (
    name.includes('صندوق') ||
    sector.includes('صندوق') ||
    name.toLowerCase().includes('etf')
  ) {
    return 'ETF';
  }

  if (
    name.includes('اوراق') ||
    sector.includes('اوراق') ||
    name.includes('تسهیلات') ||
    sector.includes('تسهیلات') ||
    name.includes('اخزا') ||
    symbol.includes('اخزا')
  ) {
    return 'BOND';
  }

  if (!symbol) {
    return 'UNKNOWN';
  }

  return 'STOCK';
};
