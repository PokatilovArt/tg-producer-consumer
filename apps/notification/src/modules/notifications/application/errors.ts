export class PermanentNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentNotificationError';
  }
}

export class UnsupportedEventTypeError extends PermanentNotificationError {
  constructor(type: string) {
    super(`Unsupported event type: ${type}`);
    this.name = 'UnsupportedEventTypeError';
  }
}
