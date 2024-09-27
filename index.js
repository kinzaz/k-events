import { eventsMap } from "./maps";
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

export default class KEvents {
  constructor(options = {}) {
    eventsMap.set(this, new Map());
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

    const listeners = getListeners(this, eventName) ?? new Set();
    const staticListeners = [...listeners];

    await Promise.all([
      ...staticListeners.map((listener) => {
        if (listeners.has(listener)) {
          return listener(eventData);
        }
      }),
    ]);
  }

  async emitSerial(eventName, eventData) {
    assertEventName(eventName);

    const listeners = getListeners(this, eventName) ?? new Set();
    const staticListeners = [...listeners];

    for (const listener of staticListeners) {
      if (listeners.has(listener)) {
        await listener(eventData);
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
}
