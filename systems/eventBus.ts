
type Listener<T> = (payload: T) => void;

class EventBus {
  private listeners: { [key: string]: Listener<any>[] } = {};

  public on<T>(event: string, callback: Listener<T>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  public off<T>(event: string, callback: Listener<T>): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      (listener) => listener !== callback
    );
  }

  public dispatch<T>(event: string, payload: T): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((listener) => {
        try {
            listener(payload)
        } catch(e) {
            console.error(`Error in event listener for ${event}:`, e);
        }
    });
  }
}

export const eventBus = new EventBus();
