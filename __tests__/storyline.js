import StorylineRunner, { IO } from '../src/storyline.js';

describe("storyline", () => {

  const BEGIN     = 'BEGIN';
  const INCREMENT = 'INC';

  const reducers = {
    score: (state = 0, action) => {
      switch (action.type) {
        case INCREMENT:
          return state + action.amount;
        default:
          return state;
      }
    }
  };

  const initialState = { score: 0 };

  it('populates store with a given initial state', () => {
    const storyline = new StorylineRunner({initialState});
    expect(storyline.getState()).toEqual(initialState);
  });

  it('uses the supplied reducers', async function() {
    const storyline = new StorylineRunner({reducers});
    await storyline.dispatch({type: INCREMENT, amount: 3});
    await storyline.dispatch({type: INCREMENT, amount: 5});
    expect(storyline.getState()).toEqual({score: 8});
  });

  it('provides an API to resolve triggered effects', async function() {
    const askForAmount = function(){};

    const storyline = async function(api) {
      await api.waitFor(BEGIN);
      const amount = await api.performIO(askForAmount);
      api.dispatch({ type: INCREMENT, amount });
    };

    const runner = new StorylineRunner({reducers, initialState});
    runner.start(storyline);

    expect(runner.getState()).toEqual({ score: 0});
    expect(runner.pendingIO().length).toEqual(0); 

    await runner.dispatch({ type: BEGIN });
    expect(runner.pendingIO()).toEqual([IO(askForAmount)]); 

    await runner.resolveIO(IO(askForAmount), 10);
    expect(runner.getState()).toEqual({ score: 10 });
  });
});

