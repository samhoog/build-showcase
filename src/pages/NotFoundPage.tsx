import { Link } from 'react-router-dom'
import { Notice } from '../components/Notice.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { useTitle } from './useTitle.ts'

export function NotFoundPage() {
  useTitle('Page not found')
  return (
    <div className="page">
      <SiteHeader />
      <Notice title="Nothing at this address">
        <p>The link may be old or mistyped.</p>
        <Link to="/">See all players</Link>
      </Notice>
    </div>
  )
}
