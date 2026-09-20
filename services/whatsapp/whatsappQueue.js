class WhatsAppQueue {
  constructor() {
    this.queue = []
    this.isProcessing = false
    this.delayMs = 1500
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    const { task, resolve, reject } = this.queue.shift()

    try {
      const result = await task()
      resolve(result)
    } catch (err) {
      reject(err)
    } finally {
      setTimeout(() => {
        this.isProcessing = false
        this.processQueue()
      }, this.delayMs)
    }
  }

  getPendingCount() {
    return this.queue.length
  }

  clear() {
    this.queue = []
    this.isProcessing = false
  }
}

export const whatsappQueue = new WhatsAppQueue()
