import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loginUser, registerUser, logoutUser } from '../../utils/chatWidget/api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loginUser', () => {
    it('should make successful login request with timing', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: { id: 'test-user-id' }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const startTime = performance.now()
      const result = await loginUser('test@example.com', 'password123')
      const endTime = performance.now()

      const executionTime = endTime - startTime

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      )

      expect(result).toEqual(mockResponse)
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle login error with timing', async () => {
      const errorMessage = 'Invalid credentials'
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: errorMessage }),
      } as Response)

      const startTime = performance.now()
      
      await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow(errorMessage)
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(3000) // Error should be handled quickly
    })

    it('should handle network timeout', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      )

      const startTime = performance.now()
      
      await expect(loginUser('test@example.com', 'password123')).rejects.toThrow('Network timeout')
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(200) // Should timeout quickly in test
    })
  })

  describe('registerUser', () => {
    it('should make successful registration request with timing', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: { id: 'test-user-id' }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const startTime = performance.now()
      const result = await registerUser('test@example.com', 'password123', 'John', 'Doe')
      const endTime = performance.now()

      const executionTime = endTime - startTime

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/register'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            first_name: 'John',
            last_name: 'Doe',
          }),
        })
      )

      expect(result).toEqual(mockResponse)
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle registration error with timing', async () => {
      const errorMessage = 'Email already exists'
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ detail: errorMessage }),
      } as Response)

      const startTime = performance.now()
      
      await expect(registerUser('existing@example.com', 'password123', 'John', 'Doe'))
        .rejects.toThrow(errorMessage)
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(3000) // Error should be handled quickly
    })
  })

  describe('logoutUser', () => {
    it('should make successful logout request with timing', async () => {
      const mockResponse = { success: true }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const startTime = performance.now()
      const result = await logoutUser('test-refresh-token')
      const endTime = performance.now()

      const executionTime = endTime - startTime

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            refresh_token: 'test-refresh-token',
          }),
        })
      )

      expect(result).toEqual(mockResponse)
      expect(executionTime).toBeLessThan(3000) // Should complete within 3 seconds
    })

    it('should handle logout error with timing', async () => {
      const errorMessage = 'Invalid refresh token'
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: errorMessage }),
      } as Response)

      const startTime = performance.now()
      
      await expect(logoutUser('invalid-refresh-token')).rejects.toThrow(errorMessage)
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(3000) // Error should be handled quickly
    })

    it('should handle logout with expired refresh token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Refresh token expired' }),
      } as Response)

      const startTime = performance.now()
      
      await expect(logoutUser('expired-refresh-token')).rejects.toThrow('Refresh token expired')
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(3000) // Should handle expired token quickly
    })
  })

  describe('Performance Benchmarks', () => {
    it('should handle multiple concurrent login requests efficiently', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: { id: 'test-user-id' }
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const startTime = performance.now()
      
      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        loginUser('test@example.com', 'password123')
      )
      
      const results = await Promise.all(promises)
      const endTime = performance.now()

      const totalTime = endTime - startTime

      expect(results).toHaveLength(5)
      expect(fetch).toHaveBeenCalledTimes(5)
      expect(totalTime).toBeLessThan(10000) // Should handle 5 concurrent requests within 10 seconds
    })

    it('should handle rapid logout requests efficiently', async () => {
      const mockResponse = { success: true }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const startTime = performance.now()
      
      // Make rapid logout requests
      const promises = Array.from({ length: 3 }, () => 
        logoutUser('test-refresh-token')
      )
      
      const results = await Promise.all(promises)
      const endTime = performance.now()

      const totalTime = endTime - startTime

      expect(results).toHaveLength(3)
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(totalTime).toBeLessThan(5000) // Should handle 3 rapid logout requests within 5 seconds
    })

    it('should handle mixed API calls efficiently', async () => {
      const loginResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: { id: 'test-user-id' }
      }
      const registerResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: { id: 'new-user-id' }
      }
      const logoutResponse = { success: true }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => loginResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => registerResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => logoutResponse,
        } as Response)

      const startTime = performance.now()
      
      // Mixed API calls
      const [loginResult, registerResult, logoutResult] = await Promise.all([
        loginUser('test@example.com', 'password123'),
        registerUser('new@example.com', 'password123', 'Jane', 'Doe'),
        logoutUser('test-refresh-token')
      ])
      
      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(loginResult).toEqual(loginResponse)
      expect(registerResult).toEqual(registerResponse)
      expect(logoutResult).toEqual(logoutResponse)
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(totalTime).toBeLessThan(8000) // Should handle mixed calls within 8 seconds
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const startTime = performance.now()
      
      await expect(loginUser('test@example.com', 'password123'))
        .rejects.toThrow('Network error')
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(1000) // Should handle network errors quickly
    })

    it('should handle malformed JSON responses', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => { throw new Error('Invalid JSON') },
      } as Response)

      const startTime = performance.now()
      
      await expect(loginUser('test@example.com', 'password123'))
        .rejects.toThrow('Login failed')
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(1000) // Should handle malformed responses quickly
    })

    it('should handle server errors with timing', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      } as Response)

      const startTime = performance.now()
      
      await expect(loginUser('test@example.com', 'password123'))
        .rejects.toThrow('Internal server error')
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(3000) // Should handle server errors within 3 seconds
    })
  })
}) 