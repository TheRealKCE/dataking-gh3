import { z } from 'zod'

const htmlBlockRegex = /[<>&]/
const scriptBlockRegex = /script|javascript:|onclick|onerror|onload|onmouseover|eval\(|data:/i

// User-facing schemas — strict, block all HTML and script patterns
export const nameSchema = z.string()
  .min(1, 'This field is required')
  .max(50, 'Must be 50 characters or less')
  .refine(val => !htmlBlockRegex.test(val), 'Invalid characters detected')
  .refine(val => !scriptBlockRegex.test(val), 'Invalid characters detected')

export const phoneSchema = z.string()
  .regex(/^(0|\+233)[2-9][0-9]{8}$/, 'Must be a valid Ghanaian phone number (e.g. 0241234567)')

export const emailSchema = z.string()
  .email('Must be a valid email address')

export const messageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(1000, 'Message must be 1000 characters or less')
  .refine(val => !htmlBlockRegex.test(val), 'Invalid characters detected')
  .refine(val => !scriptBlockRegex.test(val), 'Invalid characters detected')

export const shortTextSchema = z.string()
  .max(200, 'Must be 200 characters or less')
  .refine(val => !htmlBlockRegex.test(val), 'Invalid characters detected')
  .refine(val => !scriptBlockRegex.test(val), 'Invalid characters detected')

export const longTextSchema = z.string()
  .max(5000, 'Must be 5000 characters or less')
  .refine(val => !htmlBlockRegex.test(val), 'Invalid characters detected')
  .refine(val => !scriptBlockRegex.test(val), 'Invalid characters detected')

// Admin-only schemas — allow > and < for math/comparisons but still block script injection
export const adminLongTextSchema = z.string()
  .max(5000, 'Must be 5000 characters or less')
  .refine(val => !scriptBlockRegex.test(val), 'Script injection detected')

export const adminShortTextSchema = z.string()
  .max(200, 'Must be 200 characters or less')
  .refine(val => !scriptBlockRegex.test(val), 'Script injection detected')
