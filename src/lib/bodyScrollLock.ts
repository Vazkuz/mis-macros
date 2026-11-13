'use client'
import { useEffect } from 'react'

let openCount = 0
let previousBodyOverflow = ''
let previousHtmlOverflow = ''
let previousBodyPaddingRight = ''

export function useLockBodyScroll(open: boolean) {
  useEffect(() => {
    if (!open) return

    if (openCount === 0) {
      const html = document.documentElement
      const body = document.body

      previousHtmlOverflow = html.style.overflow
      previousBodyOverflow = body.style.overflow
      previousBodyPaddingRight = body.style.paddingRight

      // compensar el ancho de la scrollbar para evitar salto de layout
      const scrollbar = window.innerWidth - html.clientWidth
      if (scrollbar > 0) {
        const actual = parseFloat(window.getComputedStyle(body).paddingRight) || 0
        body.style.paddingRight = `${actual + scrollbar}px`
      }

      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
    }
    openCount++

    return () => {
      openCount--
      if (openCount === 0) {
        document.documentElement.style.overflow = previousHtmlOverflow
        document.body.style.overflow = previousBodyOverflow
        document.body.style.paddingRight = previousBodyPaddingRight
      }
    }
  }, [open])
}
