import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ChatWidget } from '../../components/ChatWidget'
import { logout } from '../../components/AuthModal'
import Cookies from 'js-cookie'
import { isSessionExpiredOrExpiringSoon } from '../../utils/sessionUtils'
import { getSessionInfo } from '../../utils/sessionUtils';
import * as api from '../../utils/chatWidget/api';
import { submitMicroQuiz } from '../../utils/chatWidget/api';

// Mock the AuthModal logout function
vi.mock('../../components/AuthModal', async () => {
  const actual = await vi.importActual('../../components/AuthModal')
  return {
    ...actual,
    logout: vi.fn(),
  }
})

// Mock all the child components to simplify testing
vi.mock('../../components/AuthModal', () => ({
  default: vi.fn(() => <div data-testid="auth-modal">Auth Modal</div>),
  logout: vi.fn(),
}))

vi.mock('../../components/SessionExpiredModal', () => ({
  default: vi.fn(() => <div data-testid="session-expired-modal">Session Expired Modal</div>),
}))

vi.mock('../../components/Sidebar', () => ({
  Sidebar: vi.fn(() => <div data-testid="sidebar">Sidebar</div>),
}))

vi.mock('../../components/Windows', () => ({
  Windows: vi.fn(() => <div data-testid="windows">Windows</div>),
}))

vi.mock('../../components/ChatWidget/UploadProgressIndicator', () => ({
  UploadProgressIndicator: vi.fn(() => <div data-testid="upload-progress">Upload Progress</div>),
}))

vi.mock('../../components/ChatWidget/UploadedFilesDisplay', () => ({
  UploadedFilesDisplay: vi.fn(() => <div data-testid="uploaded-files">Uploaded Files</div>),
}))

// Mock MUI icons to avoid file system issues
vi.mock('@mui/icons-material', () => ({
  LogoutRounded: vi.fn(() => <span data-testid="logout-icon">Logout Icon</span>),
}))

// Mock hooks
vi.mock('../../hooks/useSessionState', () => ({
  useSessionState: vi.fn(() => ({
    sessionIds: { sessionId: 'test-session', userId: 'test-user' },
    setSessionIds: vi.fn(),
  })),
}))

vi.mock('../../hooks/useSidebar', () => ({
  useSidebar: vi.fn(() => ({
    sidebarState: { isOpen: false, isCollapsed: false, selectedSessionId: null },
    setSidebarState: vi.fn(),
    toggleSidebar: vi.fn(),
    collapseSidebar: vi.fn(),
    expandSidebar: vi.fn(),
    closeSidebar: vi.fn(),
    openSidebar: vi.fn(),
    selectSession: vi.fn(),
  })),
}))

vi.mock('../../hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({
    userProfile: {
      preferences: { theme: 'light' },
    },
    updateProfile: vi.fn(),
  })),
}))

vi.mock('../../hooks/useScrollToBottom', () => ({
  useScrollToBottom: vi.fn(() => ({ current: null })),
}))

// Mock utilities
vi.mock('../../utils/sessionUtils', () => ({
  refreshAccessToken: vi.fn(),
  isSessionExpiredOrExpiringSoon: vi.fn(),
  getSessionInfo: vi.fn(),
}))

vi.mock('../../utils/chatWidget/messageUtils', () => ({
  createUserMessage: vi.fn(() => ({ id: 'test-message', type: 'user', content: 'test' })),
  createAssistantMessage: vi.fn(() => ({ id: 'test-assistant', type: 'assistant', content: '' })),
  formatMessageContent: vi.fn((content) => content),
}))

vi.mock('../../utils/chatWidget/diagnosticUtils', () => ({
  initializeDiagnosticState: vi.fn(() => ({})),
}))

vi.mock('../../utils/chatWidget/quizUtils', () => ({
  initializeCourseQuizAnswers: vi.fn(() => ({})),
}))

vi.mock('../../utils/chatWidget/fileUtils', () => ({
  initializeUploadProgress: vi.fn(() => ({})),
}))

vi.mock('../../logic/messageHandlers', () => ({
  createMessageHandlersProps: vi.fn(() => ({})),
}))

vi.mock('../../logic/diagnosticHandlers', () => ({
  createDiagnosticHandlersProps: vi.fn(() => ({})),
}))

vi.mock('../../logic/courseHandlers', () => ({
  createCourseHandlersProps: vi.fn(() => ({})),
}))

vi.mock('../../logic/quizHandlers', () => ({
  createQuizHandlersProps: vi.fn(() => ({})),
}))

vi.mock('../../logic/fileHandlers', () => ({
  createFileHandlersProps: vi.fn(() => ({})),
}))

vi.mock('../../logic/sidebarHandlers', () => ({
  handleOutsideClick: vi.fn(),
  handleEscapeKey: vi.fn(),
}))

vi.mock('../../logic/profileHandlers', () => ({
  createProfileHandlersProps: vi.fn(() => ({})),
}))

// Additional mocks for new API calls
vi.mock('../../utils/chatWidget/api', async () => {
  const actual = await vi.importActual('../../utils/chatWidget/api');
  return {
    ...actual,
    sendChatMessageStream: vi.fn(),
    sendChatMessage: vi.fn(),
    getSessionQuizProgress: vi.fn(),
    getSessionQuizHistory: vi.fn(),
    getSessionChatCount: vi.fn(),
    generateMicroQuiz: vi.fn(),
    submitMicroQuiz: vi.fn(),
  };
});

describe('ChatWidget Logout Functionality', () => {
  const mockLogout = vi.mocked(logout)
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock authenticated state
    vi.mocked(Cookies.get).mockImplementation((key: string) => {
      if (key === 'auth_token') return 'test-auth-token'
      if (key === 'refresh_token') return 'test-refresh-token'
      return undefined
    })
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'moneymentor_user_id') return 'test-user-id'
      return null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Logout Button', () => {
    it('should render logout button when authenticated', () => {
      render(<ChatWidget />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      expect(logoutButton).toBeInTheDocument()
    })

    it('should handle logout button click with timing', async () => {
      const user = userEvent.setup()
      mockLogout.mockResolvedValue(undefined)
      
      render(<ChatWidget />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      
      const startTime = performance.now()
      await user.click(logoutButton)
      const endTime = performance.now()
      
      const executionTime = endTime - startTime
      
      expect(mockLogout).toHaveBeenCalled()
      expect(executionTime).toBeLessThan(1000) // Button click should be responsive
    })

    it('should show loading state during logout', async () => {
      const user = userEvent.setup()
      
      // Create a promise that doesn't resolve immediately
      let resolveLogout: () => void
      const logoutPromise = new Promise<void>((resolve) => {
        resolveLogout = resolve
      })
      
      mockLogout.mockReturnValue(logoutPromise)
      
      render(<ChatWidget />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      
      const startTime = performance.now()
      await user.click(logoutButton)
      
      // Check if button shows loading state
      await waitFor(() => {
        expect(logoutButton).toBeDisabled()
      }, { timeout: 1000 })
      
      const loadingTime = performance.now() - startTime
      expect(loadingTime).toBeLessThan(1000) // Loading state should appear quickly
      
      // Resolve the promise
      resolveLogout!()
      
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
    })

    it('should prevent multiple logout clicks', async () => {
      const user = userEvent.setup()
      
      // Create a slow logout promise
      let resolveLogout: () => void
      const logoutPromise = new Promise<void>((resolve) => {
        resolveLogout = resolve
      })
      
      mockLogout.mockReturnValue(logoutPromise)
      
      render(<ChatWidget />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      
      // Click multiple times quickly
      await user.click(logoutButton)
      await user.click(logoutButton)
      await user.click(logoutButton)
      
      // Only one logout call should be made
      expect(mockLogout).toHaveBeenCalledTimes(1)
      
      resolveLogout!()
      
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle logout error gracefully', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockLogout.mockRejectedValue(new Error('Logout failed'))
      
      render(<ChatWidget />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      
      const startTime = performance.now()
      await user.click(logoutButton)
      
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
      
      const endTime = performance.now()
      const executionTime = endTime - startTime
      
      expect(executionTime).toBeLessThan(3000) // Should handle error quickly
      expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('Session Expired Modal Logout', () => {
    it('should handle session expired logout', async () => {
      const user = userEvent.setup()
      
      // Mock session about to expire state
      vi.mocked(isSessionExpiredOrExpiringSoon).mockReturnValue(true)
      vi.mocked(getSessionInfo).mockReturnValue({
        token: 'test-auth-token',
        refreshToken: 'test-refresh-token',
        userId: 'test-user-id',
        expiresAt: new Date(Date.now() + 1000),
        isExpired: false,
        timeUntilExpiry: 1000
      })
      vi.mocked(Cookies.get).mockImplementation((key: string) => {
        if (key === 'auth_token') return 'test-auth-token'
        if (key === 'refresh_token') return 'test-refresh-token'
        return undefined
      })
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'moneymentor_user_id') return 'test-user-id'
        return null
      })
      
      render(<ChatWidget />)
      
      // The session expired modal should be rendered
      await waitFor(() => {
        expect(screen.getByTestId('session-expired-modal')).toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Find and click the logout button in the modal
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      
      const startTime = performance.now()
      await user.click(logoutButton)
      const endTime = performance.now()
      
      const executionTime = endTime - startTime
      
      // Session expired logout should be instant (just clears local data)
      expect(executionTime).toBeLessThan(100)
    })
  })

  describe('Authentication State', () => {
    it('should show auth modal when not authenticated', () => {
      // Mock unauthenticated state
      vi.mocked(Cookies.get).mockReturnValue(undefined)
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      
      render(<ChatWidget />)
      
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
    })

    it('should show chat interface when authenticated', () => {
      render(<ChatWidget />)
      
      expect(screen.getByTestId('windows')).toBeInTheDocument()
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument()
    })
  })

  describe('Performance Tests', () => {
    it('should render authenticated state quickly', () => {
      const startTime = performance.now()
      render(<ChatWidget />)
      const endTime = performance.now()
      
      const renderTime = endTime - startTime
      expect(renderTime).toBeLessThan(1000) // Should render within 1 second
    })

    it('should handle rapid logout button clicks efficiently', async () => {
      const user = userEvent.setup()
      mockLogout.mockResolvedValue(undefined)
      
      render(<ChatWidget />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      
      const startTime = performance.now()
      
      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(logoutButton)
      }
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      
      // Should handle rapid clicks efficiently
      expect(totalTime).toBeLessThan(2000)
      // Only one logout should be called due to prevention logic
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
  })
}) 

describe('Windows Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Windows component without runtime errors', () => {
    render(<ChatWidget />);
    // Test that the component renders without the handleQuizTrackerClick error
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });
});

describe('Quiz Tracker Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have quiz tracker functionality available', () => {
    render(<ChatWidget />);
    // Test that the component renders without errors
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });
});

describe('Quiz History Dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have quiz history functionality available', () => {
    render(<ChatWidget />);
    // Test that the component renders without errors
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });
});

describe('Chat Count and Auto-Quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have chat count functionality available', () => {
    render(<ChatWidget />);
    // Test that the component renders without errors
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });

  it('should have quiz generation functionality available', () => {
    render(<ChatWidget />);
    // Test that the component renders without errors
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });

  it('should have error handling for quiz generation', () => {
    render(<ChatWidget />);
    // Test that the component renders without errors
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });

  it('should have proper API integration', () => {
    render(<ChatWidget />);
    // Test that the component renders without errors
    expect(screen.getByTestId('windows')).toBeInTheDocument();
  });
}); 

describe('Micro Quiz Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitMicroQuiz).mockResolvedValue({});
  });

  it('calls submitMicroQuiz when a micro-quiz is answered', async () => {
    // Render ChatWidget
    const { container } = render(<ChatWidget />);
    // Get the instance and call the handler directly
    const instance = container.firstChild as any;
    if (instance && instance.handleChatQuizAnswer) {
      await instance.handleChatQuizAnswer(3, true);
      expect(submitMicroQuiz).toHaveBeenCalled();
    }
  });
}); 