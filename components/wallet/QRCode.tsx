"use client"

import { useEffect, useRef } from "react"
import QRCodeLib from "qrcode"

interface QRCodeProps {
  value: string
  size?: number
}

export default function QRCode({ value, size = 200 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCodeLib.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 2,
          color: {
            dark: "#FFFFFF",
            light: "#242f3d",
          },
        },
        (error) => {
          if (error) console.error(error)
        },
      )
    }
  }, [value, size])

  return (
    <div className="flex justify-center">
      <div className="inline-block bg-[#242f3d] p-2 rounded-lg">
        <canvas ref={canvasRef} className="pointer-events-none" />
      </div>
    </div>
  )
}
