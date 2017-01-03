import deepEqual from 'deep-equal';
import {
  combineReducers as reduxCombineReducers,
  createStore,
  applyMiddleware
} from 'redux';

import StorylineTestAPI from './storyline_test_api';

import { onAction, pendingIO, pendingIOPromises, notifyIsBlocked } from './symbols';

const untilDoneOrBlocked = Symbol("untilDoneOrBlocked");
const start              = Symbol("start");
const api                = Symbol("api");
const done               = Symbol("done");
const store              = Symbol("store");

export const IO = (fn, ...args) => ({ fn, args });

export default class StorylineRunner {

  constructor(storyline, {
    initialState = {},
    reducers,
    middlewares = [],
    combineReducers = reduxCombineReducers
  }) {

    this[pendingIO]         = [];
    this[pendingIOPromises] = [];
    this[notifyIsBlocked]   = null;
    this[api]               = null;
    this[done]              = false;
    this[store]             = null;

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
      this[api][onAction](action);
      return result;
    };

    const allMiddleware = [...middlewares, storylineMiddleware];

    this[store] = createStore(
      finalReducer,
      initialState,
      applyMiddleware(...allMiddleware)
    );

    this[start](storyline);
  }

  getState() {
    return this[store].getState();
  }

  pendingIO() {
    return this[pendingIO].map(({io}) => io);
  }

  async dispatch(action) {
    await this[store].dispatch(action);
    await this[untilDoneOrBlocked]();
  }

  async [start](storyline) {
    this[api] = new StorylineTestAPI(this);
    await storyline(this[api]);
    this[done] = true;
  }


  async resolveIO(io, value) {
    const found = this[pendingIO].find((candidate) => {
      return deepEqual(candidate.io, io, {strict: true});
    });
    if (found) {
      found.resolve(value);
      const index = this[pendingIO].indexOf(found);
      this[pendingIO].splice(index, 1);
      const doneIO = this[pendingIOPromises].splice(index, 1);
      await doneIO;
      await this[untilDoneOrBlocked]();
    } else {
      return Promise.reject("could not find IO to resolve");
    }
  }

  isDone() {
    return this[done];
  }

  async [untilDoneOrBlocked]() {
    return await new Promise((resolve) => {
      if (this[pendingIO].length > 0) {
        this[notifyIsBlocked] = () => {
          this[notifyIsBlocked] = null;
          resolve();
        };
      } else {
        resolve();
      }
    });
  }
};

