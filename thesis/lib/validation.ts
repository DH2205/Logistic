import { z } from 'zod';

// ── Sanitization Helper ───────────────────────────────────────────────────────
/**
 * Strip HTML tags and encode dangerous characters from a string.
 * Prevents stored XSS: <script>alert(1)</script> → &lt;script&gt;alert(1)&lt;/script&gt;
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')          // remove all HTML tags  e.g. <script>...</script>
    .replace(/[<>"'`]/g, (char) => {  // encode remaining dangerous characters
      const map: Record<string, string> = {
        '<':  '&lt;',
        '>':  '&gt;',
        '"':  '&quot;',
        "'":  '&#x27;',
        '`':  '&#x60;',
      };
      return map[char];
    })
    .trim();
}

// ── Register Schema ───────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email is too long')
    .transform((v) => v.toLowerCase().trim()),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),

  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long')
    .transform(sanitizeString),

  // Empty strings from HTML forms are treated as "not provided" so the regex
  // never fires on a blank field.
  phone: z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => v === '' || /^\+?[\d\s\-().]{7,20}$/.test(v),
      'Invalid phone number (7–20 digits, spaces, +, -, or parentheses)'
    )
    .transform((v) => (v === '' ? undefined : sanitizeString(v)))
    .optional(),

  address: z
    .string()
    .max(500, 'Address is too long')
    .transform((v) => (v.trim() === '' ? undefined : sanitizeString(v.trim())))
    .optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ── Order Schema ──────────────────────────────────────────────────────────────
export const OrderSchema = z.object({
  // Optional client-supplied orderId
  orderId: z.string().max(50).transform(sanitizeString).optional(),

  // Sender
  senderName: z
    .string()
    .min(1, 'Sender name is required')
    .max(100, 'Sender name is too long')
    .transform(sanitizeString),

  senderPhone: z.string().max(20).transform(sanitizeString).optional(),

  senderEmail: z
    .string()
    .email('Invalid sender email')
    .transform((v) => v.toLowerCase().trim())
    .optional(),

  senderAddress: z.string().max(500).transform(sanitizeString).optional(),

  // Receiver
  receiverName: z
    .string()
    .min(1, 'Receiver name is required')
    .max(100, 'Receiver name is too long')
    .transform(sanitizeString),

  receiverAddress: z.string().max(500).transform(sanitizeString).optional(),

  // Package dimensions — z.coerce converts strings to numbers (form data sends strings)
  weight: z.coerce
    .number()
    .min(0.01, 'Weight must be greater than 0')
    .max(9999, 'Weight exceeds maximum allowed'),

  length:      z.coerce.number().min(0).max(999).optional(),
  width:       z.coerce.number().min(0).max(999).optional(),
  height:      z.coerce.number().min(0).max(999).optional(),
  grossWeight: z.coerce.number().min(0).max(9999).optional(),

  // Locations
  fromLocation: z.string().max(200).transform(sanitizeString).optional(),
  toLocation:   z.string().max(200).transform(sanitizeString).optional(),

  // Carrier — whitelist of allowed values only
  carrier: z.enum(['UPS', 'FedEx', 'DHL', 'USPS']).optional().default('UPS'),

  // Legacy / backwards-compatible fields
  packageName:  z.string().max(200).transform(sanitizeString).optional(),
  measurements: z.string().max(100).transform(sanitizeString).optional(),
  customerName: z.string().max(100).transform(sanitizeString).optional(),
  sender:       z.string().max(100).transform(sanitizeString).optional(),
  origin:       z.union([z.string(), z.object({ country: z.string() })]).optional(),
  destination:  z.union([z.string(), z.object({ country: z.string() })]).optional(),
});

export type OrderInput = z.infer<typeof OrderSchema>;

// ── Shared error formatter ────────────────────────────────────────────────────
/**
 * Convert Zod issues into a flat { field: [messages] } map for API responses.
 */
export function formatZodErrors(issues: z.ZodIssue[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'general';
    if (!errors[key]) errors[key] = [];
    errors[key].push(issue.message);
  }
  return errors;
}
