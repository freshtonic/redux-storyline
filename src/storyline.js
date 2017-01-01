import deepEqual from 'deep-equal';
import {
  combineReducers as reduxCombineReducers,
  createStore,
  applyMiddleware
} from 'redux';

export const IO = (fn, context, ...args) => ({ effect: 'IO', fn, context, args });

const _storyline = Symbol("storyline");
const _blocked   = Symbol("blocked");

class StorylineAPI {
  constructor(storyline) {
    this[_storyline] = storyline;
  }

  async waitFor(predicateOrActionType) {
    this[_blocked]();
    await this[_storyline]._waitFor(predicateOrActionType);
  }

  async performIO(fn, context, ...args) {
    this[_blocked]();
    const effect = IO(fn, context, ...args);

    const promise = new Promise((resolve, reject) => {
      this[_storyline]._pendingIO.push({ effect, resolve });
    })
    
    this[_storyline]._pendingIOPromises.push({ effect, promise });
    
    return await promise;
  }

  async dispatch(action) {
    await this[_storyline].dispatch(action);
  }

  [_blocked]() {
    if (this[_storyline]._notifyIsBlocked) {
      this[_storyline]._notifyIsBlocked();
    }
  }
}

export default class StorylineRunner {
  constructor({
    initialState = {},
    reducers,
    middlewares = [],
    combineReducers = reduxCombineReducers
  }) {
    this._pendingIO = [];
    this._pendingIOPromises = [];
    this._pendingActions = [];
    this._waitingFor = null;
    this._notifyIsBlocked = null;

    const makeReducer = () => {
      if (reducers) {
        return reduxCombineReducers(Object.keys(reducers).reduce(
          (rc, reducerName) => ({
            [reducerName]: reducers[reducerName], ...rc })
          , {})
        );
      } else {
        return state => state;
      }
    };

    const finalReducer = makeReducer();

    const storylineMiddleware = store => next => action => {
      const result = next(action);
      
      if (this._waitingFor) {
        const { predicateFn, resolve } = this._waitingFor;
        if (predicateFn(action)) {
          resolve();
          this._waitingFor = null;
        }
      }

      return result;
    };

    const allMiddleware = [...middlewares, storylineMiddleware];

    this.store = createStore(
      finalReducer,
      initialState,
      applyMiddleware(...allMiddleware)
    );
  }

  getState() {
    return this.store.getState();
  }

  async dispatch(action) {
    await this.store.dispatch(action);
    await this._untilDoneOrBlocked();
  }

  async _untilDoneOrBlocked() {
    if (this._pendingIO.length > 0 || this._pendingActions.length > 0) {
      await new Promise((resolve) => {
        this._notifyIsBlocked = () => {
          this._notifyIsBlocked = null;
          resolve();
        };
      });
    }
  }

  start(storyline) {
    storyline(new StorylineAPI(this));
  }

  async _waitFor(predicateOrActionType) {
    const predicateFn = typeof predicateOrActionType === 'string' ?
      (action) => action.type === predicateOrActionType
    : (action) => predicateOrActionType(action);

    return await new Promise((resolve, reject) => {
      this._waitingFor = {predicateFn, resolve};
    });
  }

  pendingIO() {
    return this._pendingIO.map(({effect}) => effect);
  }

  pendingActions() {
    return this._pendingActions.map(({action}) => action);
  }

  async resolveIO(effect, value) {
    const found = this._pendingIO.find((candidate) => {
      return deepEqual(candidate.effect, effect, {strict: true});
    });
    if (found) {
      found.resolve(value);
      const index =this._pendingIO.indexOf(found);
      this._pendingIO.splice(index, 1);
      const doneIO = this._pendingIOPromises.splice(index, 1);
      await doneIO;
      await this._untilDoneOrBlocked();
    } else {
      return Promise.reject("could not find IO to resolve");
    }
  }
};
