import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, NavLink } from 'react-router-dom'
import { logout, isAdmin } from '../../api/auth'

const LOCALES = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
]

const BASE_navLinks = [
  { to: '/' as const, labelKey: 'nav.dashboard' },
  { to: '/tickets' as const, labelKey: 'nav.tickets' },
  { to: '/members' as const, labelKey: 'nav.members' },
  { to: '/categories' as const, labelKey: 'nav.categories' },
  { to: '/balances' as const, labelKey: 'nav.balances' },
  { to: '/reports' as const, labelKey: 'nav.reports' },
]

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = isAdmin()
    ? [...BASE_navLinks, { to: '/users' as const, labelKey: 'nav.users' }]
    : BASE_navLinks

  function handleLocaleChange(locale: string) {
    i18n.changeLanguage(locale)
    localStorage.setItem('i18nextLng', locale)
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const currentLocale = LOCALES.find((l) => i18n.language.startsWith(l.code)) ?? LOCALES[0]

  return (
    <>
      <nav className="bg-pt-green text-white shadow-md relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left: hamburger (mobile) + title */}
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-2 rounded hover:bg-white/20 transition-colors"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <NavLink to="/" className="text-pt-gold font-bold text-lg tracking-tight whitespace-nowrap">
                🇵🇹 <span className="hidden sm:inline">{t('nav.title')}</span>
              </NavLink>
              {/* Desktop nav links */}
              <div className="hidden md:flex items-center gap-1 ml-2">
                {navLinks.map(({ to, labelKey }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `text-sm font-medium px-3 py-1 rounded transition-colors ${
                        isActive ? 'bg-pt-gold text-pt-green' : 'text-white hover:bg-white/20'
                      }`
                    }
                  >
                    {t(labelKey)}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Right: language selector + logout */}
            <div className="flex items-center gap-2">
              {/* Mobile: compact select */}
              <select
                value={currentLocale.code}
                onChange={(e) => handleLocaleChange(e.target.value)}
                className="md:hidden bg-white/10 border border-white/30 text-white text-sm rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-white"
                aria-label="Language"
              >
                {LOCALES.map(({ code, flag, label }) => (
                  <option key={code} value={code} className="text-black bg-white">
                    {flag} {label}
                  </option>
                ))}
              </select>

              {/* Desktop: buttons */}
              <div className="hidden md:flex items-center gap-1">
                {LOCALES.map(({ code, label, flag }) => (
                  <button
                    key={code}
                    onClick={() => handleLocaleChange(code)}
                    className={`text-sm px-2 py-1 rounded transition-colors ${
                      i18n.language.startsWith(code)
                        ? 'bg-pt-gold text-pt-green font-bold'
                        : 'text-white hover:bg-white/20'
                    }`}
                    aria-label={`Switch to ${label}`}
                  >
                    {flag} {label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleLogout}
                className="text-sm text-white hover:bg-white/20 px-3 py-1 rounded transition-colors"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] bg-pt-green text-white h-full flex flex-col shadow-xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/20">
              <span className="text-pt-gold font-bold text-lg">🇵🇹 {t('nav.title')}</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded hover:bg-white/20 transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {navLinks.map(({ to, labelKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block text-sm font-medium px-4 py-3 rounded-lg transition-colors ${
                      isActive ? 'bg-pt-gold text-pt-green' : 'text-white hover:bg-white/20'
                    }`
                  }
                >
                  {t(labelKey)}
                </NavLink>
              ))}
            </div>

            {/* Drawer footer: language + logout */}
            <div className="border-t border-white/20 px-4 py-4 space-y-3">
              <div className="flex gap-1">
                {LOCALES.map(({ code, flag, label }) => (
                  <button
                    key={code}
                    onClick={() => handleLocaleChange(code)}
                    className={`flex-1 text-sm py-2 rounded-lg transition-colors ${
                      i18n.language.startsWith(code)
                        ? 'bg-pt-gold text-pt-green font-bold'
                        : 'text-white hover:bg-white/20 border border-white/30'
                    }`}
                  >
                    {flag} {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setMenuOpen(false); handleLogout() }}
                className="w-full text-sm text-white hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-white/30"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
