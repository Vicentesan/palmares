import { TestExpectAdapter } from '@palmares/tests';

export class JestExpectAdapter extends TestExpectAdapter {
  toBe(value: any, expected: any, isNot: boolean) {
    const expect = require('@jest/globals').expect;
    if (isNot) expect(value).not.toBe(expected);
    else expect(value).toBe(expected);
  }

  toEqual(value: any, expected: any, isNot: boolean) {
    const expect = require('@jest/globals').expect;
    if (isNot) expect(value).not.toEqual(expected);
    else expect(value).toEqual(expected);
  }

  toBeDefined(value: any, isNot: boolean): void {
    const expect = require('@jest/globals').expect;
    if (isNot) expect(value).not.toBeDefined();
    else expect(value).toBeDefined();
  }

  toBeInstanceOf(value: any, expected: any, isNot: boolean): void {
    const expect = require('@jest/globals').expect;
    if (isNot) expect(value).not.toBeInstanceOf(expected);
    else expect(value).toBeInstanceOf(expected);
  }

  toStrictEqual(value: any, expected: any, isNot: boolean): void {
    const expect = require('@jest/globals').expect;
    if (isNot) expect(value).not.toStrictEqual(expected);
    else expect(value).toStrictEqual(expected);
  }

  toHaveBeenCalled(value: any, isNot: boolean) {
    const expect = require('@jest/globals').expect;

    if (isNot) expect(value).not.toHaveBeenCalled();
    else expect(value).toHaveBeenCalled();
  }

  // eslint-disable-next-line ts/require-await
  async toHaveBeenCalledTimes(value: any, isNot: boolean) {
    const expect = require('@jest/globals').expect;

    if (isNot) expect(value).not.toHaveBeenCalledTimes();
    else expect(value).toHaveBeenCalledTimes();
  }

  // eslint-disable-next-line ts/require-await
  async toHaveBeenCalledWith(value: any, args: any[], isNot: boolean) {
    const expect = require('@jest/globals').expect;
    if (isNot) expect(value).not.toHaveBeenCalledWith(...args);
    else expect(value).toHaveBeenCalledWith(...args);
  }

  // eslint-disable-next-line ts/require-await
  async toHaveReturned(value: (...args: any[]) => any, isNot: boolean) {
    const expect = require('@jest/globals').expect;

    if (isNot) expect(value).not.toHaveReturned();
    else expect(value).toHaveReturned();
  }

  // eslint-disable-next-line ts/require-await
  async toHaveReturnedTimes(value: any, expected: number, isNot: boolean) {
    const expect = require('@jest/globals').expect;

    if (isNot) expect(value).not.toHaveReturnedTimes(expected);
    else expect(value).toHaveReturnedTimes(expected);
  }
}
