/**
 * 格式化工具函数
 * @module utils/format
 */

/**
 * 将值转换为数字，无效值返回 fallback
 * @param value - 要转换的值
 * @param fallback - 转换失败时的默认值
 * @returns 转换后的数字
 */
export function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 格式化日期时间为本地字符串
 * @param value - 日期值
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(value: Date | string | number = new Date()): string {
  let text = String(value || '').trim();
  if (!text) return '--';

  // 处理 ISO 8601 格式：替换 Z 为 +00:00，处理无时区的情况
  text = text.replace(/Z$/i, '+00:00');

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 格式化日期为 MM-DD 格式
 * @param value - 日期值
 * @returns 格式化后的日期字符串
 */
export function formatDate(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * 格式化货币金额
 * @param value - 金额值
 * @param digits - 小数位数
 * @returns 格式化后的金额字符串
 */
export function formatMoney(value: unknown, digits = 2): string {
  const num = asNumber(value);
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

/**
 * 格式化带符号的货币金额
 * @param value - 金额值
 * @param digits - 小数位数
 * @returns 带符号的格式化金额字符串
 */
export function formatSignedMoney(value: unknown, digits = 2): string {
  const num = asNumber(value);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${formatMoney(num, digits)}`;
}

/**
 * 格式化为百分比
 * @param value - 百分比值
 * @param digits - 小数位数
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(value: unknown, digits = 2): string {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(digits)}%`;
}

/**
 * 根据数值正负返回 CSS 类名
 * @param value - 数值
 * @returns CSS 类名
 */
export function classBySign(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '';
  return num > 0 ? 'is-up' : 'is-down';
}

/**
 * 计算从 startDate 到今天的天数
 * @param startDate - 开始日期
 * @returns 天数或 '--'
 */
export function calcDays(startDate: string | Date | null | undefined): number | '--' {
  if (!startDate) return '--';
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return '--';
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (24 * 3600 * 1000));
}

/**
 * 计算百分比值 (value / base * 100)
 * @param value - 分子
 * @param base - 分母
 * @returns 百分比值
 */
export function toPercentValue(value: unknown, base: unknown): number {
  const v = asNumber(value);
  const b = asNumber(base);
  if (b <= 0) return 0;
  return (v / b) * 100;
}
