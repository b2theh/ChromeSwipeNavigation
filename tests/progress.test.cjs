const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../progress.uc.js'), 'utf8');

function setup() {
  const box = () => ({ collapsed: true, style: {
    opacity: '1',
    values: {},
    setProperty(key, value) { this.values[key] = value; },
    removeProperty(key) { delete this.values[key]; },
  } });
  const host = {
    _prevBox: box(), _nextBox: box(), _isStoppingAnimation: false,
    updateAnimation(update) {
      assert.equal(this, host);
      if (!this._isStoppingAnimation) {
        this._prevBox.collapsed = !(update.delta > 0);
        this._nextBox.collapsed = !(update.delta < 0);
      }
      return 'native-result';
    },
  };
  const original = host.updateAnimation;
  const window = { gHistorySwipeAnimation: host, addEventListener() {}, removeEventListener() {} };
  const context = vm.createContext({ window, location: { href: 'chrome://browser/content/browser.xhtml' } });
  vm.runInContext(source, context);
  return { host, window, original, context };
}

test('both directions reach the original background opacity at the native threshold', () => {
  const { host } = setup();
  for (const direction of [1, -1]) {
    for (const [delta, expected] of [[0.001, 0.004], [0.125, 0.5], [0.25, 1], [0.8, 1], [0.05, 0.2]]) {
      assert.equal(host.updateAnimation({ delta: direction * delta }), 'native-result');
      const box = direction > 0 ? host._prevBox : host._nextBox;
      assert.equal(Number(box.style.values['--arc-swipe-progress']), expected);
      assert.equal(box.style.opacity, '1');
    }
  }
});

test('cancellation and native fade retain the last visible progress', () => {
  const { host } = setup();
  host.updateAnimation({ delta: 0.125 });
  host.updateAnimation({ delta: 0 });
  assert.equal(host._prevBox.style.values['--arc-swipe-progress'], '0.5');
  host._isStoppingAnimation = true;
  host._prevBox.collapsed = false;
  host._prevBox.style.opacity = '0';
  host.updateAnimation({ delta: 0.25 });
  assert.equal(host._prevBox.style.values['--arc-swipe-progress'], '0.5');
  assert.equal(host._prevBox.style.opacity, '0');
});

test('reload does not stack wrappers; unload restores native behavior', () => {
  const { host, window, original, context } = setup();
  vm.runInContext(source, context);
  host.updateAnimation({ delta: 0.125 });
  assert.equal(host._prevBox.style.values['--arc-swipe-progress'], '0.5');
  window.arcSwipeProgress.destroy();
  assert.equal(host.updateAnimation, original);
  assert.equal(host._prevBox.style.values['--arc-swipe-progress'], undefined);
});
