// Helper functions for working with Telegram WebApp

export interface TelegramWebApp {
  initDataUnsafe: {
    user: any
  }
  initData: string
  version: string
  platform: string
  colorScheme: string
  HapticFeedback: {
    impactOccurred: (style: string) => void
    notificationOccurred: (type: string) => void
    selectionChanged: () => void
  }
  BackButton: {
    show: () => void
    hide: () => void
  }
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    setText: (text: string) => void
    onClick: (callback: Function) => void
    offClick: (callback: Function) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
  }
  Popup: {
    show: (params: any, callback: Function) => void
    close: () => void
  }
  isExpanded: boolean
  expand: () => void
  close: () => void
  sendData: (data: string) => void
  ready: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  onEvent: (event: string, callback: Function) => void
  offEvent: (event: string, callback: Function) => void
  viewportHeight: number
  viewportStableHeight: number
  isVersionAtLeast: (version: string) => boolean
}

export const initTelegramApp = () => {
  if (typeof window === "undefined" || !window.Telegram || !window.Telegram.WebApp) {
    return { webApp: null, isTelegram: false }
  }

  const webApp: TelegramWebApp = window.Telegram.WebApp

  // Initialize the WebApp
  webApp.ready()
  webApp.expand()

  // Set theme colors
  webApp.setBackgroundColor("#17212b")

  return { webApp, isTelegram: true }
}
