"use client"

import { useState, useMemo } from "react"
import Image from "next/image"

type MessageType = "user" | "assistant"

interface MessageBubbleProps {
  type: MessageType
  content: string
  timestamp: Date
}

// Simple URL regex (matches http, https, ftp, and file protocols)
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi

export default function MessageBubble({ type, content, timestamp }: MessageBubbleProps) {
  const [showTime, setShowTime] = useState(false)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const handleClick = () => {
    setShowTime(!showTime)
  }

  const renderContentWithLinks = (text: string) => {
    const parts = text.split(URL_REGEX)
    return parts.map((part, index) => {
      if (URL_REGEX.test(part)) {
        // It's a URL, make it a link
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
          >
            {part}
          </a>
        )
      }
      // It's a normal text part
      return <span key={index}>{part}</span>
    })
  }

  const processedContent = useMemo(() => renderContentWithLinks(content), [content])

  return (
    <div className={`flex ${type === "user" ? "justify-end" : "justify-start"} mb-4`} onClick={handleClick}>
      <div
        className={`relative max-w-[80%] px-4 py-3 backdrop-blur-md ${
          type === "user"
            ? "bg-gary-accent text-white rounded-2xl rounded-br-sm"
            : "bg-gary-bg bg-opacity-70 border border-gary-border text-gary-text rounded-2xl rounded-bl-sm"
        }`}
      >
        {type === "assistant" && (
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
        )}
        <div className="text-sm whitespace-pre-wrap">{processedContent}</div>
        {showTime && <div className="text-xs text-gary-text-secondary text-right mt-1">{formatTime(timestamp)}</div>}
      </div>
    </div>
  )
}
