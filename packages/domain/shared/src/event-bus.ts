export type Unsubscribe = () => void;

export interface EventBus<TEvent> {
  subscribe(listener: (event: TEvent) => void): Unsubscribe;
  emit(event: TEvent): void;
}

export function createEventBus<TEvent>(): EventBus<TEvent> {
  const listeners = new Set<(event: TEvent) => void>();

  return {
    subscribe(listener: (event: TEvent) => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(event: TEvent): void {
      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}
