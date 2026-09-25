export const PHONE_HINT = "Dutch mobiles are 06 plus 8 digits, like 06 1234 5678.";

export function otpError(message: string) {
  const text = message.toLowerCase();
  if (
    (text.includes("invalid") && text.includes("phone")) ||
    text.includes("not a valid phone")
  ) {
    return PHONE_HINT;
  }
  if (
    text.includes("unsupported phone") ||
    text.includes("phone provider") ||
    text.includes("sms provider") ||
    text.includes("twilio") ||
    (text.includes("sending") && text.includes("sms"))
  ) {
    return `We couldn't send a code. ${message}`;
  }
  return message;
}

// 06 1234 5678, 0031 6…, +31 6… — Dutch mobiles are +316 and eight more digits.
export function parsePhone(raw: string): { ok: true; phone: string } | { ok: false; error: string } {
  const digits = raw.replace(/[\s\-().]/g, "");
  let phone: string;
  if (digits.startsWith("00")) phone = `+${digits.slice(2)}`;
  else if (digits.startsWith("+")) phone = digits;
  else if (/^06\d{8}$/.test(digits)) phone = `+31${digits.slice(1)}`;
  else if (digits.startsWith("31") && digits.length >= 11) phone = `+${digits}`;
  else if (digits.startsWith("0")) phone = `+31${digits.slice(1)}`;
  else if (/^\d{8,15}$/.test(digits)) phone = `+${digits}`;
  else return { ok: false, error: PHONE_HINT };

  if (phone.startsWith("+31")) {
    return /^\+316\d{8}$/.test(phone) ? { ok: true, phone } : { ok: false, error: PHONE_HINT };
  }
  return /^\+\d{8,15}$/.test(phone) ? { ok: true, phone } : { ok: false, error: PHONE_HINT };
}
