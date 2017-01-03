
const _blocked     = Symbol("blocked");
const _runner      = Symbol("runner");
const _waitingFor  = Symbol("waitingFor");

export default class StorylineTestAPI {
  constructor(runner) {
    this[_runner] = runner;
  }

  async waitFor(predicateOrActionType) {
    this[_blocked]();
    const predicateFn = typeof predicateOrActionType === 'string' ?
      (action) => action.type === predicateOrActionType
    : (action) => predicateOrActionType(action);

    return await new Promise((resolve, reject) => {
      this[_waitingFor] = {predicateFn, resolve};
    });
  }

  async performIO(io) {
    this[_blocked]();

    const promise = new Promise((resolve, reject) => {
      this[_runner]._pendingIO.push({ io, resolve });
    });
    
    this[_runner]._pendingIOPromises.push({ io, promise });
    
    return await promise;
  }

  async dispatch(action) {
    await this[_runner].dispatch(action);
  }

  [_blocked]() {
    this[_runner]._blocked();
  }

  _onAction(action) {
    if (this[_waitingFor]) {
      const { predicateFn, resolve } = this[_waitingFor];
      if (predicateFn(action)) {
        resolve();
        this[_waitingFor] = null;
      }
    }
  }
}

