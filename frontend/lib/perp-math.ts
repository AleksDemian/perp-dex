const PRICE_PRECISION = 10n ** 18n;
const TOKEN_TO_USDC   = 10n ** 30n;
const BPS_DENOM       = 10_000n;
const MM_BPS          = 500n;
const FEE_BPS         = 10n;

export function calcLiquidationPrice(
  isLong: boolean,
  entry: bigint,
  leverage: number
): bigint {
  const L        = BigInt(leverage);
  const invLev18 = PRICE_PRECISION / L;
  const mm18     = (MM_BPS * PRICE_PRECISION) / BPS_DENOM;
  const factor18 = invLev18 - mm18;
  const delta    = (entry * factor18) / PRICE_PRECISION;
  return isLong ? entry - delta : entry + delta;
}

export function calcPnlUsdc(
  sizeTokens: bigint,
  entryPrice: bigint,
  markPrice: bigint,
  isLong: boolean
): bigint {
  const up      = markPrice >= entryPrice;
  const absDelta = up ? markPrice - entryPrice : entryPrice - markPrice;
  const abs     = (sizeTokens * absDelta) / TOKEN_TO_USDC;
  const positive = isLong ? up : !up;
  return positive ? abs : -abs;
}

export function calcOpenFee(collateral: bigint, leverage: number): bigint {
  return (collateral * BigInt(leverage) * FEE_BPS) / BPS_DENOM;
}

export function calcNotional(collateral: bigint, leverage: number): bigint {
  return collateral * BigInt(leverage);
}

export function calcSizeTokens(notional: bigint, price: bigint): bigint {
  if (price === 0n) return 0n;
  return (notional * TOKEN_TO_USDC) / price;
}

export function formatUsdc(amount: bigint, decimals = 2): string {
  const whole = amount / 1_000_000n;
  const frac  = amount % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").slice(0, decimals);
  return `${whole.toLocaleString()}.${fracStr}`;
}

export function formatPrice(price: bigint, decimals = 2): string {
  const whole = price / (10n ** 18n);
  const frac  = price % (10n ** 18n);
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  return `$${whole.toLocaleString()}.${fracStr}`;
}

export function formatPnl(pnl: bigint, decimals = 2): string {
  const sign = pnl >= 0n ? "+" : "-";
  const abs  = pnl >= 0n ? pnl : -pnl;
  return `${sign}$${formatUsdc(abs, decimals)}`;
}

export function usdcToBigInt(usdcString: string): bigint {
  try { return BigInt(usdcString); } catch { return 0n; }
}

export function priceToBigInt(priceString: string): bigint {
  try { return BigInt(priceString); } catch { return 0n; }
}

export function calcMarginRatio(
  collateral: bigint,
  pnl: bigint,
  notional: bigint
): number {
  if (notional === 0n) return 0;
  const equity = collateral + pnl;
  return Number((equity * 10_000n) / notional) / 100;
}
