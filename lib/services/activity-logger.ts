// Activity logger for tracking and debugging

interface LogEntry {
  timestamp: string
  action: string
  data?: any
}

// Global store for activity logs
declare global {
  interface Window {
    activityLogs: LogEntry[]
  }
}

/**
 * Log an activity for debugging and tracking
 */
export function logActivity(action: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logEntry: LogEntry = {
    timestamp,
    action,
    data,
  }

  // Log to console
  console.log(`[${timestamp}] ${action}`, data)

  // Store in memory for debug panel
  if (typeof window !== "undefined") {
    if (!window.activityLogs) {
      window.activityLogs = []
    }
    window.activityLogs.unshift(logEntry)

    // Limit log size
    if (window.activityLogs.length > 100) {
      window.activityLogs.pop()
    }

    // Dispatch event for subscribers
    const event = new CustomEvent("activity-log", { detail: logEntry })
    window.dispatchEvent(event)
  }
}

/**
 * Get all activity logs
 */
export function getActivityLogs(): LogEntry[] {
  if (typeof window !== "undefined" && window.activityLogs) {
    return window.activityLogs
  }
  return []
}

/**
 * Subscribe to activity log events
 */
export function subscribeToActivityLogs(callback: (entry: LogEntry) => void): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<LogEntry>
    callback(customEvent.detail)
  }

  window.addEventListener("activity-log", handler)

  return () => {
    window.removeEventListener("activity-log", handler)
  }
}
