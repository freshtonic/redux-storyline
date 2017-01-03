
const _blocked = Symbol("blocked");
const _runner  = Symbol("runner");

export default class StorylineTestAPI {
  constructor(runner) {
    this[_runner] = runner;
  }

  async waitFor(predicateOrActionType) {
    this[_blocked]();
    await this[_runner]._waitFor(predicateOrActionType);
  }

  async performIO(io) {
    this[_blocked]();

    const promise = new Promise((resolve, reject) => {
      this[_runner]._pendingIO.push({ io, resolve });
    })
    
    this[_runner]._pendingIOPromises.push({ io, promise });
    
    return await promise;
  }

  async dispatch(action) {
    await this[_runner].dispatch(action);
  }

  [_blocked]() {
    this[_runner]._blocked();
  }
}

