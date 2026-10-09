// Supabase Services Index
// Export all service modules for easy importing

// Core entities
export * from './branches'
export * from './rooms'
export * from './subjects'
export * from './teachers'

// Parents & Students
export * from './parents'

// Classes & Education
export * from './classes'
export * from './enrollments'

// Trial & Makeup
export * from './trials'
export * from './makeup'
export * from './trial-bookings'
// Names defined in both './trials' and './trial-bookings' — './trials' wins
export {
  cancelTrialBooking,
  cancelTrialSession,
  createTrialBooking,
  createTrialSession,
  deleteTrialBooking,
  deleteTrialSession,
  getTrialBooking,
  getTrialBookingStats,
  getTrialBookings,
  getTrialBookingsByStatus,
  getTrialSession,
  getTrialSessions,
  getTrialSessionsByBooking,
  updateBookingStatus,
  updateTrialBooking,
  updateTrialSession,
} from './trials'

// Events & Holidays
export * from './events'
export * from './holidays'

// Admin & Auth
export * from './admin-users'

// Settings
export * from './settings'

// Teaching Materials
export * from './teaching-materials'

// Notifications
export * from './notifications'

// LINE Integration
export * from './line-settings'
// Names defined in both './settings' and './line-settings' — './line-settings' wins
export {
  type LineSettings,
  getDefaultLineSettings,
  getLineSettings,
  updateLineSettings,
} from './line-settings'
export * from './line-api'
export * from './line-notifications'
export * from './link-tokens'

// LIFF (LINE Frontend Framework)
export * from './liff-schedule'
export * from './feedback'

// Reschedule & Calendar
export * from './reschedule'
export * from './dashboard'

// Data Management
export * from './data-cleaning'
export * from './factory-reset'

// Facebook Ads Integration
export * from './facebook-ads-settings'
