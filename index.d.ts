/**
kEvents accepts strings, symbols, and numbers as event names.

Symbol event names are preferred given that they can be used to avoid name collisions when your classes are extended, especially for internal events.
*/
export type EventName = PropertyKey;

/**
Removes an event subscription.
*/
export type UnsubscribeFunction = () => void;

/**
A promise returned from `emittery.once` with an extra `off` method to cancel your subscription.
*/
export type EmitteryOncePromise<T> = {
  off(): void;
} & Promise<T>;

// Helper type for turning the passed `EventData` type map into a list of string keys that don't require data alongside the event name when emitting. Uses the same trick that `Omit` does internally to filter keys by building a map of keys to keys we want to keep, and then accessing all the keys to return just the list of keys we want to keep.
type DatalessEventNames<EventData> = {
  [Key in keyof EventData]: EventData[Key] extends undefined ? Key : never;
}[keyof EventData];

export default class kEvents<
  EventData = Record<EventName, any> // TODO: Use `unknown` instead of `any`.
> {
  constructor();

  /**
	Subscribe to one or more events.

	Using the same listener multiple times for the same event will result in only one method call per emitted event.

	@returns An unsubscribe method.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();

	emitter.on('🦄', data => {
		console.log(data);
	});

	emitter.on(['🦄', '🐶'], data => {
		console.log(data);
	});

	emitter.emit('🦄', '🌈'); // log => '🌈' x2
	emitter.emit('🐶', '🍖'); // log => '🍖'
	```
	*/
  on<Name extends keyof EventData>(
    eventName: Name | readonly Name[],
    listener: (eventData: EventData[Name]) => void | Promise<void>
  ): UnsubscribeFunction;

  /**
	Get an async iterator which buffers data each time an event is emitted.

	Call `return()` on the iterator to remove the subscription.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();
	const iterator = emitter.events('🦄');

	emitter.emit('🦄', '🌈1'); // Buffered
	emitter.emit('🦄', '🌈2'); // Buffered

	iterator
		.next()
		.then(({value, done}) => {
			// done === false
			// value === '🌈1'
			return iterator.next();
		})
		.then(({value, done}) => {
			// done === false
			// value === '🌈2'
			// Revoke subscription
			return iterator.return();
		})
		.then(({done}) => {
			// done === true
		});
	```

	In practice you would usually consume the events using the [for await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) statement. In that case, to revoke the subscription simply break the loop.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();
	const iterator = emitter.events('🦄');

	emitter.emit('🦄', '🌈1'); // Buffered
	emitter.emit('🦄', '🌈2'); // Buffered

	// In an async context.
	for await (const data of iterator) {
		if (data === '🌈2') {
			break; // Revoke the subscription when we see the value `🌈2`.
		}
	}
	```

	It accepts multiple event names.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();
	const iterator = emitter.events(['🦄', '🦊']);

	emitter.emit('🦄', '🌈1'); // Buffered
	emitter.emit('🦊', '🌈2'); // Buffered

	iterator
		.next()
		.then(({value, done}) => {
			// done === false
			// value === '🌈1'
			return iterator.next();
		})
		.then(({value, done}) => {
			// done === false
			// value === '🌈2'
			// Revoke subscription
			return iterator.return();
		})
		.then(({done}) => {
			// done === true
		});
	```
	*/
  events<Name extends keyof EventData>(
    eventName: Name | readonly Name[]
  ): AsyncIterableIterator<EventData[Name]>;

  /**
	Remove one or more event subscriptions.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();

	const listener = data => {
		console.log(data);
	};

	emitter.on(['🦄', '🐶', '🦊'], listener);
	await emitter.emit('🦄', 'a');
	await emitter.emit('🐶', 'b');
	await emitter.emit('🦊', 'c');
	emitter.off('🦄', listener);
	emitter.off(['🐶', '🦊'], listener);
	await emitter.emit('🦄', 'a'); // nothing happens
	await emitter.emit('🐶', 'b'); // nothing happens
	await emitter.emit('🦊', 'c'); // nothing happens
	```
	*/
  off<Name extends keyof EventData>(
    eventName: Name | readonly Name[],
    listener: (eventData: EventData[Name]) => void | Promise<void>
  ): void;

  /**
	Subscribe to one or more events only once. It will be unsubscribed after the first
	event.

	@returns The promise of event data when `eventName` is emitted. This promise is extended with an `off` method.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();

	emitter.once('🦄').then(data => {
		console.log(data);
		//=> '🌈'
	});

	emitter.once(['🦄', '🐶']).then(data => {
		console.log(data);
	});

	emitter.emit('🦄', '🌈'); // Logs `🌈` twice
	emitter.emit('🐶', '🍖'); // Nothing happens
	```
	*/
  once<Name extends keyof EventData>(
    eventName: Name | readonly Name[]
  ): EmitteryOncePromise<EventData[Name]>;

  /**
	Trigger an event asynchronously, optionally with some data. Listeners are called in the order they were added, but executed concurrently.

	@returns A promise that resolves when all the event listeners are done. *Done* meaning executed if synchronous or resolved when an async/promise-returning function. You usually wouldn't want to wait for this, but you could for example catch possible errors. If any of the listeners throw/reject, the returned promise will be rejected with the error, but the other listeners will not be affected.
	*/
  emit<Name extends DatalessEvents>(eventName: Name): Promise<void>;
  emit<Name extends keyof EventData>(
    eventName: Name,
    eventData: EventData[Name]
  ): Promise<void>;

  /**
	Same as `emit()`, but it waits for each listener to resolve before triggering the next one. This can be useful if your events depend on each other. Although ideally they should not. Prefer `emit()` whenever possible.

	If any of the listeners throw/reject, the returned promise will be rejected with the error and the remaining listeners will *not* be called.

	@returns A promise that resolves when all the event listeners are done.
	*/
  emitSerial<Name extends DatalessEvents>(eventName: Name): Promise<void>;
  emitSerial<Name extends keyof EventData>(
    eventName: Name,
    eventData: EventData[Name]
  ): Promise<void>;

  /**
	Subscribe to be notified about any event.

	@returns A method to unsubscribe.
	*/
  onAny(
    listener: (
      eventName: keyof EventData,
      eventData: EventData[keyof EventData]
    ) => void | Promise<void>
  ): UnsubscribeFunction;

  /**
	Get an async iterator which buffers a tuple of an event name and data each time an event is emitted.

	Call `return()` on the iterator to remove the subscription.

	In the same way as for `events`, you can subscribe by using the `for await` statement.

	@example
	```
	import kEvents from 'k-events';

	const emitter = new kEvents();
	const iterator = emitter.anyEvent();

	emitter.emit('🦄', '🌈1'); // Buffered
	emitter.emit('🌟', '🌈2'); // Buffered

	iterator.next()
		.then(({value, done}) => {
			// done is false
			// value is ['🦄', '🌈1']
			return iterator.next();
		})
		.then(({value, done}) => {
			// done is false
			// value is ['🌟', '🌈2']
			// revoke subscription
			return iterator.return();
		})
		.then(({done}) => {
			// done is true
		});
	```
	*/
  anyEvent(): AsyncIterableIterator<
    [keyof EventData, EventData[keyof EventData]]
  >;

  /**
	Remove an `onAny` subscription.
	*/
  offAny(
    listener: (
      eventName: keyof EventData,
      eventData: EventData[keyof EventData]
    ) => void | Promise<void>
  ): void;

  /**
	Clear all event listeners on the instance.

	If `eventName` is given, only the listeners for that event are cleared.
	*/
  clearListeners<Name extends keyof EventData>(
    eventName?: Name | readonly Name[]
  ): void;

  /**
	The number of listeners for the `eventName` or all events if not specified.
	*/
  listenerCount<Name extends keyof EventData>(
    eventName?: Name | readonly Name[]
  ): number;
}
