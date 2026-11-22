import { configure } from '@testing-library/react';

// 他のテスト（SQL など、CPU を多く使うもの）と並列に動いても、非同期の表示を待ちきれずに失敗しないよう、待ち時間の上限を広げる
configure({ asyncUtilTimeout: 5000 });
