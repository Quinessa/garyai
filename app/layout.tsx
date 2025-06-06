import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { TelegramProvider } from "@/contexts/TelegramContext"
import { WalletProvider } from "@/contexts/WalletContext"
import { UIProvider } from "@/contexts/UIContext"
import { ChatProvider } from "@/contexts/ChatContext"
import Script from "next/script"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "GaryAI Wallet",
  description: "Your personal AI crypto assistant",
  icons: {
    icon: "/images/gary-logo.png",
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Add the Telegram WebApp script directly */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

        <Script id="telegram-webapp-init" strategy="afterInteractive">
          {`
            // Log when the script runs
            console.log('Telegram WebApp initialization script running...');
            
            // Function to initialize Telegram WebApp
            function initTelegramWebApp() {
              console.log('Checking for Telegram WebApp...');
              
              if (window.Telegram && window.Telegram.WebApp) {
                console.log('Telegram WebApp found, initializing...');
                
                try {
                  // Call ready to tell Telegram the Mini App is ready
                  window.Telegram.WebApp.ready();
                  console.log('WebApp.ready() called');
                  
                  // Expand to full height
                  window.Telegram.WebApp.expand();
                  console.log('WebApp.expand() called');
                  
                  // Fix for button click issues
                  document.addEventListener('click', function(e) {
                    // Log all clicks for debugging
                    console.log('Click detected on:', e.target);
                  }, true);
                  
                  // Log WebApp properties
                  console.log('WebApp properties:', {
                    version: window.Telegram.WebApp.version,
                    platform: window.Telegram.WebApp.platform,
                    colorScheme: window.Telegram.WebApp.colorScheme,
                    viewportHeight: window.Telegram.WebApp.viewportHeight,
                    viewportStableHeight: window.Telegram.WebApp.viewportStableHeight,
                  });
                  
                  // Store detection in localStorage for debugging
                  localStorage.setItem('telegramWebAppDetected', 'true');
                } catch (e) {
                  console.error('Error initializing Telegram WebApp:', e);
                  localStorage.setItem('telegramWebAppError', e.toString());
                }
              } else {
                console.log('Telegram WebApp not found');
                localStorage.setItem('telegramWebAppDetected', 'false');
              }
            }
            
            // Run initialization immediately
            initTelegramWebApp();
            
            // Also run after a short delay (helps with some Telegram clients)
            setTimeout(initTelegramWebApp, 500);
            
            // Fix for navigation buttons
            document.addEventListener('DOMContentLoaded', function() {
              // Add click handlers after DOM is loaded
              setTimeout(function() {
                // Create a global click handler that works with React's synthetic events
                document.addEventListener('click', function(e) {
                  const navButton = e.target.closest('nav.fixed button');
                  if (navButton) {
                    console.log('Global click handler detected nav button click:', navButton.getAttribute('data-tab-id'));
                    // Let the event continue to React's handlers
                  }
                }, true);
              }, 1000);
            });
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <TelegramProvider>
          <WalletProvider>
            <UIProvider>
              <ChatProvider>{children}</ChatProvider>
            </UIProvider>
          </WalletProvider>
        </TelegramProvider>
      </body>
    </html>
  )
}
