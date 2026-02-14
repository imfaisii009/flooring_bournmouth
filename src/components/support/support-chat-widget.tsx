'use client'

// =====================================================
// Support Chat Widget - Main Component
// =====================================================

import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useSupportStore } from '@/store/support-store'
import { getOrCreateAnonymousId } from '@/lib/utils/anonymous-id'
import SupportChatMessages from './support-chat-messages'
import SupportChatInput from './support-chat-input'

/**
 * Support Chat Widget
 * Floating button with chat modal for anonymous support
 */
export default function SupportChatWidget() {
  const {
    isOpen,
    unreadCount,
    openWidget,
    closeWidget,
    loadConversations,
    conversations,
    currentConversation,
    setCurrentConversation
  } = useSupportStore()
  const [anonymousId, setAnonymousId] = useState<string>('')
  const [isClient, setIsClient] = useState(false)

  // Initialize widget and load conversations
  useEffect(() => {
    // Set client flag for hydration
    setIsClient(true)

    // Get or create anonymous ID
    try {
      const id = getOrCreateAnonymousId()
      setAnonymousId(id)
      console.log('[Support:Widget] Anonymous ID:', id)

      // Load existing conversations for this anonymous user
      loadConversations(id)
      console.log('[Support:Widget] Loading conversations for:', id)
    } catch (error) {
      console.error('[Support:Widget] Failed to get anonymous ID:', error)
    }
  }, [loadConversations])

  // Persist current conversation ID to localStorage
  useEffect(() => {
    if (currentConversation) {
      localStorage.setItem('support_current_conversation_id', currentConversation.id)
      console.log('[Support:Widget] Saved current conversation:', currentConversation.id)
    } else {
      localStorage.removeItem('support_current_conversation_id')
    }
  }, [currentConversation])

  // Restore current conversation from localStorage when conversations load
  useEffect(() => {
    const savedConversationId = localStorage.getItem('support_current_conversation_id')
    console.log('[Support:Widget] Restore check:', {
      savedConversationId,
      conversationsCount: conversations.length,
      hasCurrentConversation: !!currentConversation,
    })

    // Skip if already have a current conversation or no conversations loaded
    if (currentConversation || conversations.length === 0) {
      return
    }

    // Try to restore saved conversation first
    if (savedConversationId) {
      const conversation = conversations.find(c => c.id === savedConversationId)
      if (conversation) {
        console.log('[Support:Widget] ✅ Restoring saved conversation:', savedConversationId)
        setCurrentConversation(conversation)
        return
      } else {
        console.warn('[Support:Widget] ⚠️ Saved conversation not found, selecting most recent')
      }
    }

    // No saved conversation or it wasn't found - auto-select most recent conversation
    const mostRecent = [...conversations].sort((a, b) =>
      new Date(b.last_message_at || b.created_at).getTime() -
      new Date(a.last_message_at || a.created_at).getTime()
    )[0]

    if (mostRecent) {
      console.log('[Support:Widget] ✅ Auto-selecting most recent conversation:', mostRecent.id)
      setCurrentConversation(mostRecent)
    }
  }, [conversations, currentConversation, setCurrentConversation])

  // Reload conversations when widget opens (ensures fresh data)
  useEffect(() => {
    if (isOpen && anonymousId) {
      loadConversations(anonymousId)
      console.log('[Support:Widget] Reloading conversations on widget open')
    }
  }, [isOpen, anonymousId, loadConversations])

  if (!isClient) {
    // Prevent hydration mismatch
    return null
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => {
          openWidget()
          useSupportStore.getState().resetUnreadCount()
        }}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 group"
        aria-label="Open support chat"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Need help?
        </span>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={closeWidget}
          />

          {/* Chat Container */}
          <div className="fixed bottom-6 right-6 w-full max-w-md md:w-96 h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-lg shadow-2xl flex flex-col z-50 mx-4 md:mx-0">
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Support Chat</h3>
                <p className="text-xs text-blue-100">We're here to help</p>
              </div>
              <button
                onClick={closeWidget}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <SupportChatMessages />

            {/* Input */}
            <SupportChatInput anonymousId={anonymousId} />
          </div>
        </>
      )}
    </>
  )
}
