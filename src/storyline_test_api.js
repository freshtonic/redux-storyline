
const runner      = Symbol("runner");
const waitingFor  = Symbol("waitingFor");
const blocked     = Symbol("blocked");

import { onAction, pendingIO, pendingIOPromises, notifyIsBlocked } from './symbols';

export default class StorylineTestAPI {
  constructor(storylineTestRunner) {
    this[runner] = storylineTestRunner;
  }

  async waitFor(predicateOrActionType) {
    this[blocked]();
    const predicateFn = typeof predicateOrActionType === 'string' ?
      (action) => action.type === predicateOrActionType
    : (action) => predicateOrActionType(action);

    return await new Promise((resolve, reject) => {
      this[waitingFor] = {predicateFn, resolve};
    });
  }

  async performIO(io) {
    this[blocked]();

    const promise = new Promise((resolve, reject) => {
      this[runner][pendingIO].push({ io, resolve });
    });
    
    this[runner][pendingIOPromises].push({ io, promise });
    
    return await promise;
  }

  dispatch(action) {
    this[runner].dispatch(action);
  }

  getState() {
    return this[runner].getState();
  }

  [blocked]() {
    if (this[runner][notifyIsBlocked]) {
      this[runner][notifyIsBlocked]();
    }
  }

  [onAction](action) {
    if (this[waitingFor]) {
      const { predicateFn, resolve } = this[waitingFor];
      if (predicateFn(action)) {
        resolve();
        this[waitingFor] = null;
      }
    }
  }
}

