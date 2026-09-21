import { useEffect } from 'react'

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | Build showcase` : 'Build showcase'
  }, [title])
}
