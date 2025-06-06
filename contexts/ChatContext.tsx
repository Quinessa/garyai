"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useUI } from "@/contexts/UIContext"

export type Message = {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
}

type ChatContextType = {
  messages: Message[]
  isTyping: boolean
  isRecording: boolean
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void
  setIsTyping: (isTyping: boolean) => void
  setIsRecording: (isRecording: boolean) => void
  clearMessages: () => void
}

const ChatContext = createContext<ChatContextType>({
  messages: [],
  isTyping: false,
  isRecording: false,
  addMessage: () => {},
  setIsTyping: () => {},
  setIsRecording: () => {},
  clearMessages: () => {},
})

export const useChat = () => useContext(ChatContext)

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const { logActivity } = useUI()

  // Initialize messages on component mount
  useEffect(() => {
    setMessages([
      {
        id: "1",
        type: "assistant",
        content: "Hi there! I'm Gary, your AI crypto assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ])
    logActivity("Chat session started, messages reset.")
  }, [logActivity]) // logActivity is stable, this should run once on ChatProvider mount

  // Save messages to localStorage whenever they change, for persistence during the session
  useEffect(() => {
    // Only save if there are messages and it's not just the initial default message
    if (messages.length > 0 && (messages.length > 1 || messages[0].id !== "1")) {
      localStorage.setItem("chatMessages", JSON.stringify(messages))
      logActivity("Chat messages saved to session.")
    }
  }, [messages, logActivity]) // Added logActivity to dependencies for completeness if it were to change, though it's stable.

  const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
    logActivity(
      `${message.type === "user" ? "User" : "AI"} message: ${message.content.substring(0, 50)}${message.content.length > 50 ? "..." : ""}`,
    )
  }

  const clearMessages = () => {
    setMessages([
      {
        id: "1",
        type: "assistant",
        content: "Hi there! I'm Gary, your AI crypto assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ])
    localStorage.removeItem("chatMessages")
    logActivity("Chat messages cleared")
  }

  return (
    <ChatContext.Provider
      value={{
        messages,
        isTyping,
        isRecording,
        addMessage,
        setIsTyping,
        setIsRecording,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
