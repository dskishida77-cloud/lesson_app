import { describe, expect, it } from 'vitest';
import { CLICK_MOVE_THRESHOLD_PX, isSelectGesture } from '../../src/render/picking';

describe('isSelectGesture', () => {
  it('移動量が閾値未満なら、選択として扱う', () => {
    expect(isSelectGesture(0)).toBe(true);
    expect(isSelectGesture(CLICK_MOVE_THRESHOLD_PX - 1)).toBe(true);
  });

  it('移動量が閾値以上なら、回転操作として選択しない', () => {
    expect(isSelectGesture(CLICK_MOVE_THRESHOLD_PX)).toBe(false);
    expect(isSelectGesture(120)).toBe(false);
  });

  it('閾値は 6px', () => {
    expect(CLICK_MOVE_THRESHOLD_PX).toBe(6);
  });
});
