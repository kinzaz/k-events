import { anyMap, eventsMap, producersMap } from "./maps";

const anyProducer = Symbol("anyProducer");

function assertListener(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("listener must be a function");
  }
}

const isEventKeyType = (key) =>
  typeof key === "string" || typeof key === "symbol" || typeof key === "number";

function assertEventName(eventName) {
  if (!isEventKeyType(eventName)) {
    throw new TypeError("`eventName` must be a string, symbol, or number");
  }
}

function getListeners(instance, eventName) {
  const events = eventsMap.get(instance);
  if (!events.has(eventName)) {
    return;
  }

  return events.get(eventName);
}

function getEventProducers(instance, eventName) {
  const key = isEventKeyType(eventName) ? eventName : anyProducer;
  const producers = producersMap.get(instance);
  if (!producers.has(key)) {
    return;
  }

  return producers.get(key);
}

function enqueueProducers(instance, eventName, eventData) {
  const producers = producersMap.get(instance);
  if (producers.has(eventName)) {
    for (const producer of producers.get(eventName)) {
      producer.enqueue(eventData);
    }
  }

  if (producers.has(anyProducer)) {
    const item = Promise.all([eventName, eventData]);
    for (const producer of producers.get(anyProducer)) {
      producer.enqueue(item);
    }
  }
}

function iterator(instance, eventNames) {
  eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];

  let isFinished = false;
  let flush = () => {};
  let queue = [];

  const producer = {
    enqueue(item) {
      queue.push(item);
      flush();
    },
    finish() {
      isFinished = true;
      flush();
    },
  };

  for (const eventName of eventNames) {
    let set = getEventProducers(instance, eventName);
    if (!set) {
      set = new Set();
      const producers = producersMap.get(instance);
      producers.set(eventName, set);
    }

    set.add(producer);
  }

  return {
    async next() {
      if (!queue) {
        return { done: true };
      }

      if (queue.length === 0) {
        if (isFinished) {
          queue = undefined;
          return this.next();
        }

        await new Promise((resolve) => {
          flush = resolve;
        });

        return this.next();
      }

      return {
        done: false,
        value: await queue.shift(),
      };
    },

    async return(value) {
      queue = undefined;

      for (const eventName of eventNames) {
        const set = getEventProducers(instance, eventName);

        if (set) {
          set.delete(producer);
          if (set.size === 0) {
            const producers = producersMap.get(instance);
            producers.delete(eventName);
          }
        }
      }

      flush();

      return arguments.length > 0
        ? { done: true, value: await value }
        : { done: true };
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

export default class kEvents {
  constructor() {
    eventsMap.set(this, new Map());
    anyMap.set(this, new Set());
    producersMap.set(this, new Map());

    producersMap.get(this).set(anyProducer, new Set());
  }

  on(eventNames, listener) {
    assertListener(listener);

    eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];

    for (const eventName of eventNames) {
      assertEventName(eventName);
      let set = getListeners(this, eventName);
      if (!set) {
        set = new Set();
        const events = eventsMap.get(this);
        events.set(eventName, set);
      }

      set.add(listener);
    }

    return this.off.bind(this, eventNames, listener);
  }

  async emit(eventName, eventData) {
    assertEventName(eventName);
    enqueueProducers(this, eventName, eventData);

    const listeners = getListeners(this, eventName) ?? new Set();
    const anyListeners = anyMap.get(this);

    const staticListeners = [...listeners];
    const staticAnyListeners = [...anyListeners];

    await Promise.all([
      ...staticListeners.map((listener) => {
        if (listeners.has(listener)) {
          return listener(eventData);
        }
      }),
      ...staticAnyListeners.map((listener) => {
        if (anyListeners.has(listener)) {
          return listener(eventName, eventData);
        }
      }),
    ]);
  }

  async emitSerial(eventName, eventData) {
    assertEventName(eventName);

    const listeners = getListeners(this, eventName) ?? new Set();
    const anyListeners = anyMap.get(this);
    const staticListeners = [...listeners];
    const staticAnyListeners = [...anyListeners];

    for (const listener of staticListeners) {
      if (listeners.has(listener)) {
        await listener(eventData);
      }
    }

    for (const listener of staticAnyListeners) {
      if (anyListeners.has(listener)) {
        await listener(eventName, eventData);
      }
    }
  }

  off(eventNames, listener) {
    assertListener(listener);
    eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
    for (const eventName of eventNames) {
      assertEventName(eventName);

      let set = getListeners(this, eventName);

      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          const events = eventsMap.get(this);
          events.delete(eventName);
        }
      }
    }
  }

  once(eventNames) {
    let off_;

    const promise = new Promise((resolve) => {
      off_ = this.on(eventNames, (data) => {
        off_();
        resolve(data);
      });
    });
    promise.off = off_;
    return promise;
  }

  clearListeners(eventNames) {
    eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];

    for (const eventName of eventNames) {
      if (isEventKeyType(eventName)) {
        const set = getListeners(this, eventName);
        if (set) {
          set.clear();
        }
      } else {
        for (const [eventName, listeners] of eventsMap.get(this).entries()) {
          listeners.clear();
          eventsMap.get(this).delete(eventName);
        }
      }
    }
  }

  listenerCount(eventNames) {
    eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
    let count = 0;

    for (const eventName of eventNames) {
      if (isEventKeyType(eventName)) {
        count += getListeners(this, eventName)?.size ?? 0;
        continue;
      }

      if (eventName !== undefined) {
        assertEventName(eventName);
      }

      for (const value of eventsMap.get(this).values()) {
        count += value.size;
      }
    }

    return count;
  }

  onAny(listener) {
    assertListener(listener);
    anyMap.get(this).add(listener);

    return this.offAny.bind(this, listener);
  }

  offAny(listener) {
    assertListener(listener);
    anyMap.get(this).delete(listener);
  }

  events(eventNames) {
    eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];

    for (const eventName of eventNames) {
      assertEventName(eventName);
    }

    return iterator(this, eventNames);
  }
}
