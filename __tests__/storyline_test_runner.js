import StorylineTestRunner, { IO } from '../src/storyline_test_runner';

describe("StorylineTestRunner", () => {

  describe("basic examples", () => {
    const BEGIN     = 'BEGIN';
    const INCREMENT = 'INCREMENT';

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
      const runner = new StorylineTestRunner(() => {}, {initialState});
      expect(runner.getState()).toEqual(initialState);
    });

    it('uses the supplied reducers', async function() {
      const runner = new StorylineTestRunner(() => {}, {reducers});
      await runner.dispatch({type: INCREMENT, amount: 3});
      await runner.dispatch({type: INCREMENT, amount: 5});
      expect(runner.getState()).toEqual({score: 8});
    });

    it('provides an API to resolve triggered effects', async function() {
      const askForAmount = function(){};

      const storyline = async function(api) {
        await api.waitFor(BEGIN);
        const amount = await api.performIO(IO(askForAmount));
        api.dispatch({ type: INCREMENT, amount });
      };

      const runner = new StorylineTestRunner(storyline, {reducers, initialState});

      expect(runner.getState()).toEqual({ score: 0});
      expect(runner.pendingIO().length).toEqual(0); 

      await runner.dispatch({ type: BEGIN });
      expect(runner.pendingIO()).toEqual([IO(askForAmount)]); 

      await runner.resolveIO(IO(askForAmount), 10);
      expect(runner.getState()).toEqual({ score: 10 });
    });
  });

  describe('advanced example', () => {

    const BEGIN_CREATE_ACCOUNT = 'signup/BEGIN_CREATE_ACCOUNT';

    const EMAIL_SUBMITTED           = 'signup/EMAIL_SUBMITTED';
    const VALIDATE_EMAIL            = 'signup/VALIDATE_EMAIL';
    const EMAIL_PASSCODE_SENT       = 'signup/EMAIL_PASSCODE_SENT';
    const EMAIL_PASSCODE_SUBMITTED  = 'signup/EMAIL_PASSCODE_SUBMITTED';
    const EMAIL_PASSCODE_MATCHED    = 'signup/EMAIL_PASSCODE_MATCHED';
    const SET_EMAIL_ERROR           = 'signup/SET_EMAIL_ERROR';

    const MOBILE_SUBMITTED          = 'signup/MOBILE_SUBMITTED';
    const VALIDATE_MOBILE           = 'signup/VALIDATE_MOBILE';
    const MOBILE_PASSCODE_SENT      = 'signup/MOBILE_PASSCODE_SENT';
    const MOBILE_PASSCODE_SUBMITTED = 'signup/MOBILE_PASSCODE_SUBMITTED';
    const MOBILE_PASSCODE_MATCHED   = 'signup/MOBILE_PASSCODE_MATCHED';
    const SET_MOBILE_ERROR          = 'signup/SET_MOBILE_ERROR';

    const ACCOUNT_CREATED           = 'signup/ACCOUNT_CREATED';

    const initialState = {
      email: null,
      emailSent: null,
      emailPasscode: null,
      emailVerified: false,
      mobile: null,
      mobileSent: null,
      mobilePasscode: null,
      mobileVerified: false,
      accountCreated: false
    };

    const reducers = {
      signup: (state = initialState, action) => {
        switch (action.type) {
          case EMAIL_SUBMITTED:
            return Object.assign({}, state, { email: action.email });
          case EMAIL_PASSCODE_SENT:
            return Object.assign({}, state, { emailSent: action.email });
          case EMAIL_PASSCODE_SUBMITTED:
            return Object.assign({}, state, { emailPasscode: action.passcode });
          case MOBILE_SUBMITTED:
            return Object.assign({}, state, { mobile: action.mobile });
          case MOBILE_PASSCODE_SENT:
            return Object.assign({}, state, { mobileSent: action.mobile });
          case MOBILE_PASSCODE_SUBMITTED:
            return Object.assign({}, state, { mobilePasscode: action.passcode });
          case ACCOUNT_CREATED:
            return Object.assign({}, state, { accountCreated: true });
          default:
            return state;
        }
      }
    };

    const sendEmailPasscode   = () => {};
    const verifyEmail         = () => {};
    const sendMobilePasscode  = () => {};
    const verifyMobile        = () => {};
    const createAccount       = () => {};

    const captureVerifiedEmail = async function(api) {
      while (true) {
        await api.waitFor(EMAIL_SUBMITTED);
        const email = api.getState().signup.email;
        if (email && email.match(/@/)) {
          await api.performIO(IO(sendEmailPasscode, email));
          api.dispatch({ type: EMAIL_PASSCODE_SENT, email });
          await api.waitFor(EMAIL_PASSCODE_SUBMITTED);
          const passcodeEnteredByUser = api.getState().signup.emailPasscode;
          const verificationId = await api.performIO(IO(verifyEmail, passcodeEnteredByUser));
          if (verificationId) {
            api.dispatch({ type: EMAIL_PASSCODE_MATCHED });
            return verificationId;
          }
        } else {
          api.dispatch({
            type: SET_EMAIL_ERROR,
            error: "email addresses should contain a '@' character"
          });
        }
        continue;
      }
    };

    const captureVerifiedMobile = async function(api) {
      while (true) {
        await api.waitFor(MOBILE_SUBMITTED);
        const mobile = api.getState().signup.mobile;
        if (mobile && mobile.match(/^[0-9\s]+$/)) {
          await api.performIO(IO(sendMobilePasscode, mobile));
          api.dispatch({ type: MOBILE_PASSCODE_SENT, mobile });
          await api.waitFor(MOBILE_PASSCODE_SUBMITTED);
          const passcodeEnteredByUser = api.getState().signup.mobilePasscode;
          const verificationId = await api.performIO(IO(verifyMobile, passcodeEnteredByUser));
          if (verificationId) {
            api.dispatch({ type: MOBILE_PASSCODE_MATCHED });
            return verificationId;
          }
        } else {
          api.dispatch({
            type: SET_MOBILE_ERROR,
            error: "mobile number should only contain digits and whitespace"
          });
        }
        continue;
      }
    };

    const signupStoryline = async function(api) {
      await api.waitFor(BEGIN_CREATE_ACCOUNT);
      const verifiedEmailId = await captureVerifiedEmail(api);
      const verifiedMobileId = await captureVerifiedMobile(api);
      await api.performIO(IO(createAccount, verifiedEmailId, verifiedMobileId));
      await api.dispatch({ type: ACCOUNT_CREATED });
    };

    it('can run a 2FA signup process', async function() {
      const runner = new StorylineTestRunner(signupStoryline, {reducers});

      await runner.dispatch({ type: BEGIN_CREATE_ACCOUNT });

      await runner.dispatch({ type: EMAIL_SUBMITTED, email: "foo@bar.com" });
      expect(runner.pendingIO()).toEqual([IO(sendEmailPasscode, "foo@bar.com")]);
      await runner.resolveIO(IO(sendEmailPasscode, "foo@bar.com"));
      expect(runner.getState().signup.email).toEqual("foo@bar.com");
      expect(runner.getState().signup.emailSent).toEqual("foo@bar.com");
      await runner.dispatch({ type: EMAIL_PASSCODE_SUBMITTED, passcode: "123456" });
      expect(runner.pendingIO()).toEqual([IO(verifyEmail, "123456")]);
      await runner.resolveIO(IO(verifyEmail, "123456"), "some-uuid-1");


      await runner.dispatch({ type: MOBILE_SUBMITTED, mobile: "0123 456789" });
      expect(runner.pendingIO()).toEqual([IO(sendMobilePasscode, "0123 456789")]);
      await runner.resolveIO(IO(sendMobilePasscode, "0123 456789"));
      expect(runner.getState().signup.mobile).toEqual("0123 456789");
      expect(runner.getState().signup.mobileSent).toEqual("0123 456789");
      await runner.dispatch({ type: MOBILE_PASSCODE_SUBMITTED, passcode: "123456" });
      expect(runner.pendingIO()).toEqual([IO(verifyMobile, "123456")]);
      await runner.resolveIO(IO(verifyMobile, "123456"), "some-uuid-2");

      expect(runner.pendingIO()).toEqual([IO(createAccount, "some-uuid-1", "some-uuid-2")]);
      await runner.resolveIO(IO(createAccount, "some-uuid-1", "some-uuid-2"));
      expect(runner.getState().signup.accountCreated).toBe(true);
    });
  });
});

