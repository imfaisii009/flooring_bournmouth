'use client'

// =====================================================
// Support Chat Input - Message Input Component
// =====================================================

import { useState, FormEvent, useRef } from 'react'
import { Send, Loader2, Image as ImageIcon, X } from 'lucide-react'
import { useSupportStore } from '@/store/support-store'

interface SupportChatInputProps {
  anonymousId: string
}

/**
 * Support Chat Input
 * Handles message input and sending with image support
 */
export default function SupportChatInput({ anonymousId }: SupportChatInputProps) {
  const {
    currentConversation,
    createConversation,
    sendMessage,
    isSending,
    error,
    setError,
  } = useSupportStore()

  const [message, setMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Maximum size is 5MB.')
      return
    }

    setSelectedImage(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Prevent double submission
    if (isSubmitting || isSending || !anonymousId || (!message.trim() && !selectedImage)) {
      return
    }

    setIsSubmitting(true)

    const messageText = message.trim()
    let imageUrl: string | undefined

    // Upload image if selected
    if (selectedImage) {
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', selectedImage)

        const uploadResponse = await fetch('/api/support/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }

        const uploadData = await uploadResponse.json()
        imageUrl = uploadData.url
      } catch (err) {
        console.error('[Support:Input] Failed to upload image:', err)
        setError('Failed to upload image. Please try again.')
        setIsUploading(false)
        setIsSubmitting(false)
        return
      } finally {
        setIsUploading(false)
      }
    }

    // Clear inputs
    setMessage('')
    clearImage()

    try {
      if (!currentConversation) {
        // Create new conversation with initial message
        console.log('[Support:Input] Creating new conversation')
        await createConversation(anonymousId, messageText || 'Image')
      } else {
        // Send message to existing conversation
        console.log('[Support:Input] Sending message')
        await sendMessage(messageText || '', imageUrl)
      }
    } catch (err) {
      console.error('[Support:Input] Failed to send message:', err)
      // Restore message on error (but not image)
      if (messageText) setMessage(messageText)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if conversation is closed or resolved
  if (
    currentConversation?.status === 'closed' ||
    currentConversation?.status === 'resolved'
  ) {
    return (
      <div className="p-4 border-t bg-gray-50">
        <div className="text-center mb-3">
          <p className="text-sm text-gray-600 mb-2">
            {currentConversation.status === 'closed'
              ? '🔒 This conversation has been closed.'
              : '✅ This conversation has been resolved.'}
          </p>
        </div>
        <button
          onClick={() => {
            useSupportStore.setState({
              currentConversation: null,
              messages: [],
            })
            setMessage('')
            setError(null)
          }}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Start New Ticket
        </button>
      </div>
    )
  }

  return (
    <div className="border-t bg-white">
      {/* Error display */}
      {error && (
        <div className="px-4 pt-3">
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded-lg border border-gray-300"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageSelect}
            className="hidden"
            disabled={isSending || isUploading || isSubmitting}
          />

          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isUploading || isSubmitting}
            className="border border-gray-300 text-gray-600 p-3 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Attach image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Text input */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              currentConversation
                ? 'Type your message...'
                : 'Describe your issue...'
            }
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm text-gray-900 placeholder:text-gray-400"
            disabled={isSending || isUploading || isSubmitting}
            maxLength={5000}
            autoFocus={!currentConversation}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isSending || isUploading || isSubmitting || (!message.trim() && !selectedImage)}
            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            {isSending || isUploading || isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Character counter (optional) */}
        {message.length > 4000 && (
          <p className="text-xs text-gray-500 mt-2 text-right">
            {message.length} / 5000 characters
          </p>
        )}

        {/* Helper text */}
        {!currentConversation && (
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send your message to our support team
          </p>
        )}
      </form>
    </div>
  )
}
