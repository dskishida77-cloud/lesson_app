import { useState } from 'react';
import type { FormEvent } from 'react';
import { normalizeNames, MAX_NAME_LENGTH } from '../app/names';
import type { PlayerId, PlayerSettings } from '../core';

interface StartScreenProps {
  onStart: (settings: PlayerSettings) => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [first, setFirst] = useState<PlayerId>(0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart({ names: normalizeNames(names), firstPlayer: first });
  };

  const setName = (i: 0 | 1, value: string) =>
    setNames((prev) => (i === 0 ? [value, prev[1]] : [prev[0], value]));

  return (
    <form className="start-screen" onSubmit={submit}>
      <h1>3D コネクト フォー</h1>
      <p className="start-lead">縦・横・奥行き・斜めのどこかに、自分の駒を4つ並べよう。</p>
      {([0, 1] as const).map((i) => (
        <label key={i} className="field">
          <span>プレイヤー{i + 1}の名前</span>
          <input
            type="text"
            value={names[i]}
            maxLength={MAX_NAME_LENGTH}
            placeholder={`プレイヤー${i + 1}`}
            onChange={(e) => setName(i, e.target.value)}
          />
        </label>
      ))}
      <fieldset className="field">
        <legend>先手</legend>
        {([0, 1] as const).map((i) => (
          <label key={i} className="radio">
            <input
              type="radio"
              name="first"
              checked={first === i}
              onChange={() => setFirst(i)}
              aria-label={`プレイヤー${i + 1}が先手`}
            />
            プレイヤー{i + 1}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="primary">ゲーム開始</button>
    </form>
  );
}
