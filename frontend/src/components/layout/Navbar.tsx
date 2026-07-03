import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, NavLink, useLocation } from 'react-router-dom'
import { logout, isAdmin } from '../../api/auth'

const LOCALES = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
]

const MAIN_NAV = [
  { to: '/' as const, labelKey: 'nav.dashboard' },
  { to: '/tickets' as const, labelKey: 'nav.tickets' },
  { to: '/balances' as const, labelKey: 'nav.balances' },
  { to: '/reports' as const, labelKey: 'nav.reports' },
]

const SETTINGS_NAV = [
  { to: '/members' as const, labelKey: 'nav.members' },
  { to: '/categories' as const, labelKey: 'nav.categories' },
]

const SETTINGS_NAV_ADMIN = [
  ...SETTINGS_NAV,
  { to: '/users' as const, labelKey: 'nav.users' },
]

const SETTINGS_PATHS = ['/members', '/categories', '/users']

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  const admin = isAdmin()
  const settingsLinks = admin ? SETTINGS_NAV_ADMIN : SETTINGS_NAV
  const settingsActive = SETTINGS_PATHS.some((p) => location.pathname.startsWith(p))

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

            {/* Left: hamburger (mobile) + title + desktop nav */}
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
                {MAIN_NAV.map(({ to, labelKey }) => (
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

                {/* Settings dropdown */}
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setSettingsOpen((v) => !v)}
                    className={`text-sm font-medium px-3 py-1 rounded transition-colors flex items-center gap-1 ${
                      settingsActive ? 'bg-pt-gold text-pt-green' : 'text-white hover:bg-white/20'
                    }`}
                  >
                    {t('nav.settings')}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {settingsOpen && (
                    <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                      {settingsLinks.map(({ to, labelKey }) => (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={() => setSettingsOpen(false)}
                          className={({ isActive }) =>
                            `block px-4 py-2 text-sm transition-colors ${
                              isActive ? 'bg-pt-green/10 text-pt-green font-medium' : 'text-gray-700 hover:bg-gray-50'
                            }`
                          }
                        >
                          {t(labelKey)}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />

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
              {MAIN_NAV.map(({ to, labelKey }) => (
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

              {/* Settings collapsible section */}
              <button
                onClick={() => setMobileSettingsOpen((v) => !v)}
                className={`w-full flex items-center justify-between text-sm font-medium px-4 py-3 rounded-lg transition-colors ${
                  settingsActive ? 'bg-pt-gold text-pt-green' : 'text-white hover:bg-white/20'
                }`}
              >
                {t('nav.settings')}
                <svg
                  className={`w-4 h-4 transition-transform ${mobileSettingsOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileSettingsOpen && (
                <div className="pl-4 space-y-1">
                  {settingsLinks.map(({ to, labelKey }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `block text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ${
                          isActive ? 'bg-pt-gold text-pt-green' : 'text-white/80 hover:bg-white/20'
                        }`
                      }
                    >
                      {t(labelKey)}
                    </NavLink>
                  ))}
                </div>
              )}
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
