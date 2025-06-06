"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, Mic } from "lucide-react"
import { useTelegram } from "@/contexts/TelegramContext"

interface InputAreaProps {
  onSendMessage: (message: string) => void
  onStartRecording: () => void
  onStopRecording: () => void
  isRecording: boolean
}

export default function InputArea({ onSendMessage, onStartRecording, onStopRecording, isRecording }: InputAreaProps) {
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { hapticFeedback } = useTelegram()

  // Fix for Telegram input issues
  useEffect(() => {
    if (!inputRef.current) return

    // Apply these styles directly
    inputRef.current.style.userSelect = "text"
    inputRef.current.style.WebkitUserSelect = "text"

    // Prevent zoom on iOS
    inputRef.current.style.fontSize = "16px"

    // Create a function to handle focus
    const handleFocus = () => {
      if (inputRef.current) {
        inputRef.current.style.userSelect = "text"
        inputRef.current.style.WebkitUserSelect = "text"
      }
    }

    // Create a function to handle blur
    const handleBlur = () => {
      if (inputRef.current) {
        inputRef.current.style.userSelect = "text"
        inputRef.current.style.WebkitUserSelect = "text"
      }
    }

    // Add event listeners
    inputRef.current.addEventListener("focus", handleFocus)
    inputRef.current.addEventListener("blur", handleBlur)

    // Cleanup
    return () => {
      if (inputRef.current) {
        inputRef.current.removeEventListener("focus", handleFocus)
        inputRef.current.removeEventListener("blur", handleBlur)
      }
    }
  }, [])

  const handleSend = () => {
    if (message.trim()) {
      hapticFeedback("medium")
      onSendMessage(message)
      setMessage("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRecordToggle = () => {
    if (isRecording) {
      hapticFeedback("medium")
      onStopRecording()
    } else {
      hapticFeedback("medium")
      onStartRecording()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [message])

  return (
    <div className="relative w-full">
      <div className="relative flex items-center p-1 pl-4 pr-1 rounded-full border border-gary-border bg-gary-bg bg-opacity-70 backdrop-blur-md">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or use your voice..."
          className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[40px] text-gary-text text-sm"
          style={{
            userSelect: "text",
            WebkitUserSelect: "text",
            fontSize: "16px", // Prevent zoom on iOS
          }}
          rows={1}
          disabled={isRecording}
        />

        <div className="flex items-center">
          {isRecording ? (
            <button
              onClick={onStopRecording}
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white ml-2"
            >
              <div className="w-3 h-3 bg-white rounded-sm"></div>
            </button>
          ) : (
            <button
              onClick={message.trim() ? handleSend : handleRecordToggle}
              className="w-10 h-10 rounded-full bg-gary-accent flex items-center justify-center text-white ml-2 gary-glow-box"
            >
              {message.trim() ? <Send size={18} /> : <Mic size={18} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
