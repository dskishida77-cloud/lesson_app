/** ポインタの移動量がこの値（px）未満のクリックのみを「柱の選択」とみなす */
export const CLICK_MOVE_THRESHOLD_PX = 6;

/** ドラッグ（盤面の回転）と、柱の選択（タップ・クリック）を区別する */
export function isSelectGesture(movedPx: number): boolean {
  return movedPx < CLICK_MOVE_THRESHOLD_PX;
}
