## Install

```sh
npm install k-events
```

## Usage

```js
import KEvents from "k-events";

const emitter = new KEvents();

emitter.on("🦄", (data) => {
  console.log(data);
});

const myUnicorn = Symbol("🦄");

emitter.on(myUnicorn, (data) => {
  console.log(`Unicorns love ${data}`);
});

emitter.emit("🦄", "🌈"); // Will trigger printing '🌈'
emitter.emit(myUnicorn, "🦋"); // Will trigger printing 'Unicorns love 🦋'
```

## API

### eventName

KEvents accepts strings, symbols, and numbers as event names.

Symbol event names are preferred given that they can be used to avoid name collisions when your classes are extended, especially for internal events.

#### on(eventName | eventName[], listener)

Subscribe to one or more events.

Returns an unsubscribe method.

Using the same listener multiple times for the same event will result in only one method call per emitted event.

```js
import kEvents from "k-events";

const emitter = new kEvents();

emitter.on("🦄", (data) => {
  console.log(data);
});

emitter.on(["🦄", "🐶"], (data) => {
  console.log(data);
});

emitter.emit("🦄", "🌈"); // log => '🌈' x2
emitter.emit("🐶", "🍖"); // log => '🍖'
```

###### Listener data

- `listener` - The listener that was added.
- `eventName` - The name of the event that was added or removed if `.on()` or `.off()` was used, or `undefined` if `.onAny()` or `.offAny()` was used.

Only events that are not of this type are able to trigger these events.

##### listener(data)

#### off(eventName | eventName[], listener)

Remove one or more event subscriptions.

```js
import kEvents from "k-events";

const emitter = new kEvents();

const listener = (data) => {
  console.log(data);
};

emitter.on(["🦄", "🐶", "🦊"], listener);
await emitter.emit("🦄", "a");
await emitter.emit("🐶", "b");
await emitter.emit("🦊", "c");
emitter.off("🦄", listener);
emitter.off(["🐶", "🦊"], listener);
await emitter.emit("🦄", "a"); // Nothing happens
await emitter.emit("🐶", "b"); // Nothing happens
await emitter.emit("🦊", "c"); // Nothing happens
```

##### listener(data)

#### once(eventName | eventName[])

Subscribe to one or more events only once. It will be unsubscribed after the first event.

Returns a promise for the event data when `eventName` is emitted. This promise is extended with an `off` method.

```js
import kEvents from "k-events";

const emitter = new kEvents();

emitter.once("🦄").then((data) => {
  console.log(data);
  //=> '🌈'
});

emitter.once(["🦄", "🐶"]).then((data) => {
  console.log(data);
});

emitter.emit("🦄", "🌈"); // Log => '🌈' x2
emitter.emit("🐶", "🍖"); // Nothing happens
```

#### events(eventName)

Get an async iterator which buffers data each time an event is emitted.

Call `return()` on the iterator to remove the subscription.

```js
import kEvents from "k-events";

const emitter = new kEvents();
const iterator = emitter.events("🦄");

emitter.emit("🦄", "🌈1"); // Buffered
emitter.emit("🦄", "🌈2"); // Buffered

iterator
  .next()
  .then(({ value, done }) => {
    // done === false
    // value === '🌈1'
    return iterator.next();
  })
  .then(({ value, done }) => {
    // done === false
    // value === '🌈2'
    // Revoke subscription
    return iterator.return();
  })
  .then(({ done }) => {
    // done === true
  });
```

In practice, you would usually consume the events using the [for await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) statement. In that case, to revoke the subscription simply break the loop.

```js
import kEvents from "k-events";

const emitter = new kEvents();
const iterator = emitter.events("🦄");

emitter.emit("🦄", "🌈1"); // Buffered
emitter.emit("🦄", "🌈2"); // Buffered

// In an async context.
for await (const data of iterator) {
  if (data === "🌈2") {
    break; // Revoke the subscription when we see the value '🌈2'.
  }
}
```

It accepts multiple event names.

```js
import kEvents from "k-events";

const emitter = new kEvents();
const iterator = emitter.events(["🦄", "🦊"]);

emitter.emit("🦄", "🌈1"); // Buffered
emitter.emit("🦊", "🌈2"); // Buffered

iterator
  .next()
  .then(({ value, done }) => {
    // done === false
    // value === '🌈1'
    return iterator.next();
  })
  .then(({ value, done }) => {
    // done === false
    // value === '🌈2'
    // Revoke subscription
    return iterator.return();
  })
  .then(({ done }) => {
    // done === true
  });
```

#### emit(eventName, data?)

Trigger an event asynchronously, optionally with some data. Listeners are called in the order they were added, but executed concurrently.

Returns a promise that resolves when all the event listeners are done. _Done_ meaning executed if synchronous or resolved when an async/promise-returning function. You usually wouldn't want to wait for this, but you could for example catch possible errors. If any of the listeners throw/reject, the returned promise will be rejected with the error, but the other listeners will not be affected.

#### emitSerial(eventName, data?)

Same as above, but it waits for each listener to resolve before triggering the next one. This can be useful if your events depend on each other. Although ideally they should not. Prefer `emit()` whenever possible.

If any of the listeners throw/reject, the returned promise will be rejected with the error and the remaining listeners will _not_ be called.

#### onAny(listener)

Subscribe to be notified about any event.

Returns a method to unsubscribe.

##### listener(eventName, data)

#### offAny(listener)

Remove an `onAny` subscription.

#### anyEvent()

Get an async iterator which buffers a tuple of an event name and data each time an event is emitted.

Call `return()` on the iterator to remove the subscription.

```js
import kEvents from "k-events";

const emitter = new kEvents();
const iterator = emitter.anyEvent();

emitter.emit("🦄", "🌈1"); // Buffered
emitter.emit("🌟", "🌈2"); // Buffered

iterator
  .next()
  .then(({ value, done }) => {
    // done === false
    // value is ['🦄', '🌈1']
    return iterator.next();
  })
  .then(({ value, done }) => {
    // done === false
    // value is ['🌟', '🌈2']
    // Revoke subscription
    return iterator.return();
  })
  .then(({ done }) => {
    // done === true
  });
```

In the same way as for `events`, you can subscribe by using the `for await` statement

#### clearListeners(eventNames?)

Clear all event listeners on the instance.

If `eventNames` is given, only the listeners for that events are cleared.

#### listenerCount(eventNames?)

The number of listeners for the `eventNames` or all events if not specified.
