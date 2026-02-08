const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY

let scriptLoaded = false
let scriptLoading = false
let scriptLoadPromise = null

function loadPaystackScript() {
  if (scriptLoaded && window.PaystackPop) return Promise.resolve()
  if (scriptLoading && scriptLoadPromise) return scriptLoadPromise

  scriptLoading = true
  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="js.paystack.co"]')
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true

    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      resolve()
    }

    script.onerror = () => {
      scriptLoading = false
      scriptLoadPromise = null
      reject(new Error('Failed to load Paystack. Please check your internet connection and try again.'))
    }

    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

export async function initializePaystack({ email, amountKobo, reference, metadata, onSuccess, onClose }) {
  if (!PAYSTACK_PUBLIC_KEY) {
    throw new Error('Paystack public key is not configured.')
  }

  await loadPaystackScript()

  if (!window.PaystackPop) {
    throw new Error('Paystack failed to initialize. Please refresh and try again.')
  }

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: amountKobo,
    currency: 'NGN',
    ref: reference,
    metadata,
    callback: (response) => {
      onSuccess(response)
    },
    onClose: () => {
      if (onClose) onClose()
    }
  })

  handler.openIframe()
}

export function generateReference() {
  return `pcgh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
