import { getExpect } from './expect';
import { getTestAdapter, getTestAdapterCustomProps } from './utils';

import type { TestAdapter } from './adapter';
import type { Expect } from './expect';

/**
 * Describe a test suite to run tests in
 *
 * @example
 * ```typescript
 * describe('Test suite', ({ test }) => {
 *   test('Test', async ({ expect }) => {
 *     expect(1).toBe(1);
 *   });
 * });
 * ```
 *
 * @param descriptionName The name of the test suite
 * @param callback The callback to run the tests, the callback will for convenience receive the
 * `test` function to run tests and the `custom` object that was passed to the test adapter
 */
export function describe<TTestAdapter extends TestAdapter = TestAdapter>(
  descriptionName: string,
  callback: (
    args: {
      test: typeof test<TTestAdapter>;
      beforeEach: typeof beforeEach<TTestAdapter>;
      afterEach: typeof afterEach<TTestAdapter>;
    } & {
      custom: Awaited<ReturnType<TTestAdapter['getCustomProps']>>;
    }
  ) => void,
  customArgs?: Parameters<TTestAdapter['functions']['getDescribe']>[2]
) {
  const defaultTestAdapter = getTestAdapter();
  const custom = getTestAdapterCustomProps();
  defaultTestAdapter.functions.getDescribe(
    descriptionName,
    () => {
      return callback({
        test,
        beforeEach,
        afterEach,
        custom: custom
      });
    },
    customArgs
  );
}

/**
 * Run a test it can be either called inside a `describe` or on its own
 *
 * @example
 * ```typescript
 * test('Test', async ({ expect }) => {
 *  expect(1).toBe(1);
 * });
 * ```
 *
 * @param testName The name of the test
 * @param callback The callback to run the test, the callback will for convenience receive the
 * `expect` function to run assertions and the `custom` object that was passed to the test adapter
 */
export function test<TTestAdapter extends TestAdapter = TestAdapter>(
  testName: string,
  callback: (
    args: {
      expect: typeof expect;
    } & {
      custom: Awaited<ReturnType<TTestAdapter['getCustomProps']>>;
    }
  ) => Promise<void> | void,
  customArgs?: Parameters<TTestAdapter['functions']['getTest']>[2]
) {
  const defaultTestAdapter = getTestAdapter();

  defaultTestAdapter.functions.getTest(
    testName,
    async () =>
      Promise.resolve(
        callback({
          expect: expect,
          custom: (await defaultTestAdapter.getCustomProps()) as any
        })
      ),
    customArgs
  );
}

/**
 * Run a function before each test.
 *
 * @example
 * ```typescript
 * beforeEach(({ custom }) => {
 *   db.init();
 * });
 * ```
 *
 * @param callback The callback to run before each test, the callback will for convenience receive the
 * `custom` object that was passed to the test adapter
 */
export function beforeEach<TTestAdapter extends TestAdapter = TestAdapter>(
  callback: (args: { custom: Awaited<ReturnType<TTestAdapter['getCustomProps']>> }) => Promise<void> | void,
  customArgs?: Parameters<TTestAdapter['functions']['getBeforeEach']>[2]
) {
  const defaultTestAdapter = getTestAdapter();
  defaultTestAdapter.functions.getBeforeEach(
    async () =>
      Promise.resolve(
        callback({
          custom: (await defaultTestAdapter.getCustomProps()) as any
        })
      ),
    customArgs
  );
}

/**
 * Run a function after each test.
 *
 * @example
 *  ```typescript
 * afterEach(({ custom }) => {
 *   db.flush();
 * });
 * ```
 *
 * @param callback - The callback to run after each test, the callback will for convenience receive the
 * `custom` object that was passed to the test adapter
 */
export function afterEach<TTestAdapter extends TestAdapter = TestAdapter>(
  callback: (args: { custom: Awaited<ReturnType<TTestAdapter['getCustomProps']>> }) => Promise<void> | void,
  customArgs?: Parameters<TTestAdapter['functions']['getAfterEach']>[2]
) {
  const defaultTestAdapter = getTestAdapter();
  defaultTestAdapter.functions.getAfterEach(
    async () =>
      Promise.resolve(
        callback({
          custom: (await defaultTestAdapter.getCustomProps()) as any
        })
      ),
    customArgs
  );
}

/**
 * Run a function before all tests.
 *
 * @example
 * ```typescript
 * beforeAll(({ custom }) => {
 *   db.seed();
 * });
 * ```
 *
 * @param callback - The callback to run before all tests, the callback will for convenience receive the
 * `custom` object that was passed to the test adapter
 */
export function beforeAll<TTestAdapter extends TestAdapter = TestAdapter>(
  callback: (args: { custom: Awaited<ReturnType<TTestAdapter['getCustomProps']>> }) => Promise<void> | void,
  customArgs?: Parameters<TTestAdapter['functions']['getBeforeAll']>[2]
) {
  const defaultTestAdapter = getTestAdapter();
  defaultTestAdapter.functions.getBeforeAll(
    async () =>
      Promise.resolve(
        callback({
          custom: (await defaultTestAdapter.getCustomProps()) as any
        })
      ),
    customArgs
  );
}

/**
 * Run a function after all tests.
 *
 * @example
 * ```typescript
 * afterAll(({ custom }) => {
 *   db.flush();
 * });
 * ```
 *
 * @param callback - The callback to run after all tests, the callback will for convenience receive the
 * `custom` object that was passed to the test adapter
 */
export function afterAll<TTestAdapter extends TestAdapter = TestAdapter>(
  callback: (args: { custom: Awaited<ReturnType<TTestAdapter['getCustomProps']>> }) => Promise<void> | void,
  customArgs?: Parameters<TTestAdapter['functions']['getAfterAll']>[2]
) {
  const defaultTestAdapter = getTestAdapter();
  defaultTestAdapter.functions.getAfterAll(
    async () =>
      Promise.resolve(
        callback({
          custom: (await defaultTestAdapter.getCustomProps()) as any
        })
      ),
    customArgs
  );
}

export function expect<TValue, TTestAdapter extends TestAdapter = TestAdapter>(
  value: TValue
): Expect<TValue, TTestAdapter, false> {
  const expect = getTestAdapter().expect.assign?.(value);
  const palmaresExpect = getExpect.bind(expect)(value, getTestAdapter() as TTestAdapter);
  return palmaresExpect;
  return getExpect<TValue, TTestAdapter>(value, getTestAdapter() as TTestAdapter);
}
