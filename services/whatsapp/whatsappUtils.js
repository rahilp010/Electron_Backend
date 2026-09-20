/**
 * Normalizes phone numbers for WhatsApp compatibility, specifically for Indian (+91) numbers.
 * @param {string} phone 
 * @returns {{ isValid: boolean, normalized: string, waId: string, formatted: string, error?: string }}
 */
export function normalizeWhatsAppNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      normalized: '',
      waId: '',
      formatted: '',
      error: 'Phone number is empty or invalid.'
    }
  }

  // Remove non-digit characters
  let digits = phone.replace(/\D/g, '')

  if (!digits) {
    return {
      isValid: false,
      normalized: '',
      waId: '',
      formatted: '',
      error: 'No digits found in phone number.'
    }
  }

  // Strip leading zero if present (e.g., 09876543210 -> 9876543210)
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1)
  }

  // Handle standard 10-digit Indian numbers
  if (digits.length === 10) {
    digits = '91' + digits
  }

  // Handle 12-digit numbers starting with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    const mobileDigits = digits.slice(2)
    if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      return {
        isValid: false,
        normalized: digits,
        waId: `${digits}@c.us`,
        formatted: `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`,
        error: 'Invalid Indian mobile number prefix.'
      }
    }

    return {
      isValid: true,
      normalized: digits,
      waId: `${digits}@c.us`,
      formatted: `+91 ${mobileDigits.slice(0, 5)} ${mobileDigits.slice(5)}`,
      error: null
    }
  }

  // International numbers (between 11 and 15 digits)
  if (digits.length >= 11 && digits.length <= 15) {
    return {
      isValid: true,
      normalized: digits,
      waId: `${digits}@c.us`,
      formatted: `+${digits}`,
      error: null
    }
  }

  return {
    isValid: false,
    normalized: digits,
    waId: `${digits}@c.us`,
    formatted: phone,
    error: 'Phone number length is invalid for WhatsApp.'
  }
}

/**
 * Replaces template variables like {clientName}, {pendingAmount} in template string
 * @param {string} template 
 * @param {Record<string, any>} data 
 * @returns {string}
 */
export function interpolateTemplate(template, data = {}) {
  if (!template) return ''
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null) {
      return String(data[key])
    }
    return match
  })
}

export const DEFAULT_TEMPLATES = {
  reminder: `Hello {clientName},

This is a friendly reminder regarding your pending payment.

Pending Amount: ₹{pendingAmount}

Please contact us if you have any questions or require assistance.

Thank you,
{companyName}`,

  invoice: `Hello {clientName},

Thank you for your business!

Invoice No: {invoiceNumber}
Invoice Amount: ₹{invoiceAmount}

Please find your invoice attached.

Thank you,
{companyName}`,

  receipt: `Hello {clientName},

We have received your payment of ₹{amount}.

Receipt No: {receiptNumber}
Payment Mode: {paymentMode}
Remaining Pending Amount: ₹{pendingAmount}

Thank you,
{companyName}`,

  ledger: `Hello {clientName},

Please find your updated account ledger attached.

Current Pending Amount: ₹{pendingAmount}

Thank you,
{companyName}`
}
