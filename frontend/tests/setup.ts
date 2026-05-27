import '@testing-library/jest-dom'
import axios from 'axios'
import { server } from './mocks/server'

// Use node http adapter so MSW node server can intercept axios requests in jsdom env
axios.defaults.adapter = 'http'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
