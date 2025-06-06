"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"

interface GaryLogoProps {
  size?: "sm" | "md" | "lg"
  withText?: boolean
}

export default function GaryLogo({ size = "md", withText = true }: GaryLogoProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push("/")
  }

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  }

  const dimensions = {
    sm: 24,
    md: 32,
    lg: 40,
  }

  return (
    <div className="flex items-center cursor-pointer" onClick={handleClick}>
      <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
        <Image
          src="/images/gary-logo.png"
          alt="GaryAI Logo"
          width={dimensions[size]}
          height={dimensions[size]}
          className="object-contain"
          style={{ background: "transparent" }}
        />
      </div>

      {withText && (
        <div className="ml-2 font-bold text-white flex items-center">
          <span className="gary-glow text-gary-accent">GARY</span>
          <span className="text-gary-text-secondary ml-1 text-sm">AI</span>
        </div>
      )}
    </div>
  )
}
