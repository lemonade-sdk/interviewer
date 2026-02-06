type Listener = (...args: any[]) => void;

/**
 * Simple browser-compatible EventEmitter implementation
 * Replaces Node.js 'events' module for browser environments
 */
export class EventEmitter {
  private events: { [key: string]: Listener[] } = {};

  /**
   * Add a listener for an event
   */
  on(event: string, listener: Listener): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * Add a one-time listener for an event
   */
  once(event: string, listener: Listener): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    this.on(event, wrapper);
    return this;
  }

  /**
   * Remove a listener for an event
   */
  off(event: string, listener: Listener): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  /**
   * Emit an event with arguments
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    
    // Create a copy to avoid issues if listeners are removed during execution
    const listeners = [...this.events[event]];
    listeners.forEach(l => l(...args));
    return true;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
  
  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    return this.events[event] ? this.events[event].length : 0;
  }
}
