import deepEqual from 'deep-equal';
import {
  combineReducers as reduxCombineReducers,
  createStore,
  applyMiddleware
} from 'redux';

import StorylineTestAPI from './storyline_test_api';

export const IO = (fn, context, ...args) => ({ fn, context, args });

const _start      = Symbol("start");
const _storyline  = Symbol("storyline");
const _api        = Symbol("api");

export default class StorylineRunner {
  constructor(storyline, {
    initialState = {},
    reducers,
    middlewares = [],
    combineReducers = reduxCombineReducers
  }) {
    this._pendingIO = [];
    this._pendingIOPromises = [];
    this._notifyIsBlocked = null;
    this[_api] = null;
    this.done = false;

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
      this[_api]._onAction(action);
      return result;
    };

    const allMiddleware = [...middlewares, storylineMiddleware];

    this.store = createStore(
      finalReducer,
      initialState,
      applyMiddleware(...allMiddleware)
    );

    this[_start](storyline);
  }

  getState() {
    return this.store.getState();
  }

  async dispatch(action) {
    await this.store.dispatch(action);
    await this._untilDoneOrBlocked();
  }

  async _untilDoneOrBlocked() {
    if (this._pendingIO.length > 0) {
      await new Promise((resolve) => {
        this._notifyIsBlocked = () => {
          this._notifyIsBlocked = null;
          resolve();
        };
      });
    }
  }

  async [_start](storyline) {
    this[_api] = new StorylineTestAPI(this);
    await storyline(this[_api]);
    this._done = true;
  }

  pendingIO() {
    return this._pendingIO.map(({io}) => io);
  }

  async resolveIO(io, value) {
    const found = this._pendingIO.find((candidate) => {
      return deepEqual(candidate.io, io, {strict: true});
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

  isDone() {
    return this._done;
  }

  _blocked() {
    if (this._notifyIsBlocked) {
      this._notifyIsBlocked();
    }
  }
};

