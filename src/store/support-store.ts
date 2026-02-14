// =====================================================
// Support Chat Store - Zustand State Management
// =====================================================

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type {
  SupportConversation,
  SupportMessage,
} from '@/types/support'

interface SupportState {
  // UI State
  isOpen: boolean
  unreadCount: number

  // Data
  conversations: SupportConversation[]
  currentConversation: SupportConversation | null
  messages: SupportMessage[]

  // Loading states
  isLoading: boolean
  isSending: boolean
  error: string | null

  // Actions
  openWidget: () => void
  closeWidget: () => void
  loadConversations: (anonymousId: string) => Promise<void>
  createConversation: (anonymousId: string, initialMessage: string) => Promise<void>
  setCurrentConversation: (conversation: SupportConversation | null) => void
  loadConversationMessages: (conversationId: string, anonymousId: string) => Promise<void>
  sendMessage: (content: string, imageUrl?: string) => Promise<void>
  updateConversationStatus: (status: 'open' | 'resolved' | 'closed') => Promise<void>

  // Realtime
  subscribeToMessages: (conversationId: string) => () => void
  incrementUnreadCount: () => void
  resetUnreadCount: () => void
  setError: (error: string | null) => void
}

// Track active subscription to prevent duplicates
let activeSubscription: {
  conversationId: string
  unsubscribe: () => void
} | null = null

/**
 * Support Chat Store
 * Manages support chat state with Supabase Realtime integration
 */
export const useSupportStore = create<SupportState>((set, get) => ({
  // Initial state
  isOpen: false,
  unreadCount: 0,
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,

  // =====================================================
  // UI Actions
  // =====================================================

  openWidget: () => {
    console.log('[Support:Store] Opening widget')
    set({ isOpen: true, unreadCount: 0, error: null })
  },

  closeWidget: () => {
    console.log('[Support:Store] Closing widget')
    set({ isOpen: false })
  },

  resetUnreadCount: () => {
    set({ unreadCount: 0 })
  },

  incrementUnreadCount: () => {
    set((state) => ({ unreadCount: state.unreadCount + 1 }))
  },

  setError: (error: string | null) => {
    set({ error })
  },

  // =====================================================
  // Conversation Actions
  // =====================================================

  loadConversations: async (anonymousId: string) => {
    console.log('[Support:Store] Loading conversations for:', anonymousId)
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(
        `/api/support/conversations?anonymous_id=${encodeURIComponent(anonymousId)}`
      )

      if (!response.ok) {
        throw new Error('Failed to load conversations')
      }

      const data = await response.json()
      set({ conversations: data.conversations, isLoading: false })

      console.log('[Support:Store] Loaded conversations:', data.conversations.length)
    } catch (error) {
      console.error('[Support:Store] Failed to load conversations:', error)
      set({
        error: 'Failed to load conversations',
        isLoading: false,
      })
    }
  },

  createConversation: async (anonymousId: string, initialMessage: string) => {
    console.log('[Support:Store] Creating conversation')
    set({ isLoading: true, error: null })

    try {
      const response = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymous_id: anonymousId,
          initial_message: initialMessage,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create conversation')
      }

      const data = await response.json()
      const { conversation, messages } = data

      console.log('[Support:Store] Created conversation:', conversation.id)

      set({
        currentConversation: conversation,
        messages: messages || [],
        isLoading: false,
      })

      // Subscribe to realtime updates
      get().subscribeToMessages(conversation.id)
    } catch (error) {
      console.error('[Support:Store] Failed to create conversation:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to create conversation',
        isLoading: false,
      })
    }
  },

  setCurrentConversation: (conversation: SupportConversation | null) => {
    console.log('[Support:Store] Setting current conversation:', conversation?.id)

    // Clean up previous subscription
    if (activeSubscription) {
      activeSubscription.unsubscribe()
      activeSubscription = null
    }

    if (conversation) {
      // Try to restore messages from localStorage first (instant load)
      const cacheKey = `support_messages_${conversation.id}`
      const cachedMessages = localStorage.getItem(cacheKey)
      const initialMessages = cachedMessages ? JSON.parse(cachedMessages) : []

      console.log('[Support:Store] 📝 Setting conversation:', {
        id: conversation.id,
        cacheKey,
        cachedCount: initialMessages.length,
        hasCachedData: !!cachedMessages,
      })

      set({ currentConversation: conversation, messages: initialMessages })

      if (initialMessages.length > 0) {
        console.log('[Support:Store] ✅ Restored', initialMessages.length, 'messages from localStorage')
      } else {
        console.log('[Support:Store] ⚠️  No cached messages found, will load from API')
      }

      // Load messages from server and subscribe (will update if there are new messages)
      const anonymousId = localStorage.getItem('support_anonymous_id')
      if (anonymousId) {
        console.log('[Support:Store] 🔄 Loading fresh messages from API for conversation:', conversation.id)
        get().loadConversationMessages(conversation.id, anonymousId)
        get().subscribeToMessages(conversation.id)
      } else {
        console.error('[Support:Store] ❌ No anonymous ID found in localStorage!')
      }
    } else {
      set({ currentConversation: null, messages: [] })
    }
  },

  loadConversationMessages: async (conversationId: string, anonymousId: string) => {
    try {
      const response = await fetch(
        `/api/support/conversations/${conversationId}?anonymous_id=${encodeURIComponent(anonymousId)}`
      )

      if (!response.ok) {
        throw new Error('Failed to load messages')
      }

      const data = await response.json()
      const messages = data.messages || []
      set({ messages })

      // Save to localStorage for instant restore on refresh
      if (messages.length > 0) {
        localStorage.setItem(`support_messages_${conversationId}`, JSON.stringify(messages))
        console.log('[Support:Store] Saved', messages.length, 'messages to cache')
      }

      console.log('[Support:Store] Loaded messages:', messages.length)
    } catch (error) {
      console.error('[Support:Store] Failed to load messages:', error)
      set({ error: 'Failed to load messages' })
    }
  },

  updateConversationStatus: async (status: 'open' | 'resolved' | 'closed') => {
    const { currentConversation } = get()
    if (!currentConversation) return

    const anonymousId = localStorage.getItem('support_anonymous_id')
    if (!anonymousId) return

    try {
      const response = await fetch(
        `/api/support/conversations/${currentConversation.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, anonymous_id: anonymousId }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      const data = await response.json()
      set({ currentConversation: data.conversation })

      console.log('[Support:Store] Updated conversation status:', status)
    } catch (error) {
      console.error('[Support:Store] Failed to update status:', error)
      set({ error: 'Failed to update conversation status' })
    }
  },

  // =====================================================
  // Message Actions
  // =====================================================

  sendMessage: async (content: string, imageUrl?: string) => {
    const { currentConversation, messages } = get()
    if (!currentConversation) {
      console.error('[Support:Store] No current conversation')
      return
    }

    const anonymousId = localStorage.getItem('support_anonymous_id')
    if (!anonymousId) {
      console.error('[Support:Store] No anonymous ID found')
      return
    }

    // Generate unique temp ID
    const tempId = `temp_${Date.now()}_${Math.random()}`

    // Optimistic update - add temporary message
    const tempMessage: SupportMessage = {
      id: tempId,
      conversation_id: currentConversation.id,
      sender_type: 'user',
      sender_name: null,
      sender_telegram_id: null,
      content: content || null,
      image_url: imageUrl || null,
      telegram_message_id: null,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    }

    console.log('[Support:Store] Sending message (optimistic)')
    set({
      messages: [...messages, tempMessage],
      isSending: true,
      error: null,
    })

    try {
      const response = await fetch(
        `/api/support/conversations/${currentConversation.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            image_url: imageUrl,
            anonymous_id: anonymousId,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      await response.json()

      // Success! Realtime will add the message automatically
      // Just clean up the temp message after a short delay
      setTimeout(() => {
        const currentMessages = get().messages
        set({
          messages: currentMessages.filter(m => m.id !== tempId),
          isSending: false,
        })
      }, 500)

      console.log('[Support:Store] Message sent, realtime will add it')
    } catch (error) {
      console.error('[Support:Store] Failed to send message:', error)

      // Remove temporary message on error
      const currentMessages = get().messages
      set({
        messages: currentMessages.filter(m => m.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to send message',
        isSending: false,
      })
    }
  },

  // =====================================================
  // Realtime Subscription
  // =====================================================

  subscribeToMessages: (conversationId: string) => {
    // Prevent duplicate subscriptions
    if (activeSubscription?.conversationId === conversationId) {
      console.log('[Support:Store] Already subscribed to:', conversationId)
      return activeSubscription.unsubscribe
    }

    // Clean up previous subscription
    if (activeSubscription) {
      console.log('[Support:Store] Cleaning up previous subscription')
      activeSubscription.unsubscribe()
    }

    console.log('[Support:Store] Subscribing to messages for:', conversationId)

    const supabase = createClient()
    const channel = supabase
      .channel(`support_messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as SupportMessage
          const state = get()

          console.log('[Support:Store] Realtime message received:', {
            id: newMessage.id,
            sender_type: newMessage.sender_type,
            has_content: !!newMessage.content,
          })

          // Check if message already exists (avoid duplicates)
          const messageExists = state.messages.some((m) => m.id === newMessage.id)

          if (!messageExists) {
            // Remove any temp messages before adding real message
            const messagesWithoutTemp = state.messages.filter(m => !m.id.startsWith('temp_'))
            const updatedMessages = [...messagesWithoutTemp, newMessage]

            // Add message to state
            set({ messages: updatedMessages })

            // Save to localStorage for persistence
            localStorage.setItem(`support_messages_${conversationId}`, JSON.stringify(updatedMessages))

            console.log('[Support:Store] Realtime added message, removed temp messages')

            // Increment unread count if from support and widget closed
            if (newMessage.sender_type === 'support' && !state.isOpen) {
              console.log('[Support:Store] Incrementing unread count')
              set({ unreadCount: state.unreadCount + 1 })
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Support:Store] Realtime subscription status:', status)
      })

    const unsubscribe = () => {
      console.log('[Support:Store] Unsubscribing from messages')
      supabase.removeChannel(channel)
      activeSubscription = null
    }

    activeSubscription = { conversationId, unsubscribe }
    return unsubscribe
  },
}))
