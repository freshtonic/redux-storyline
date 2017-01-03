
# redux-storyline

`redux-storyline` is a library for building testable workflows (storylines)
with side effects.

It is inspired by `redux-saga` but with an API that can only interact with
a storyline in the manner that your Redux application can:

1. By observing actions
2. By performing I/O
3. By dispatching actions

This means that storylines can be tested in a black-box manner. The actions
implemented by your reducers are the public API, as are the I/O operations that
can be performed by the storyline.

