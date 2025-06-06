"use client"

import Image from "next/image"

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="relative max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm bg-gary-bg bg-opacity-70 backdrop-blur-md border border-gary-border text-gary-text">
        <div className="flex items-center mb-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <Image
              src="/images/gary-logo.png"
              alt="GaryAI Logo"
              width={24}
              height={24}
              className="object-contain"
              style={{ background: "transparent" }}
            />
          </div>
          <span className="ml-2 text-sm font-medium gary-glow text-gary-accent">GARY AI</span>
        </div>
        <div className="flex space-x-2">
          <div
            className="w-2 h-2 rounded-full bg-gary-accent animate-bounce opacity-75"
            style={{ animationDelay: "0ms" }}
          ></div>
          <div
            className="w-2 h-2 rounded-full bg-gary-accent animate-bounce opacity-75"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-2 h-2 rounded-full bg-gary-accent animate-bounce opacity-75"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    </div>
  )
}
