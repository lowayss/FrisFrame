const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createPhoneRemoteBridge } = require('../electron/phone-remote.cjs');

test('served controller boots, refreshes preview, releases controls and stops sensors', async () => {
  const bridge = createPhoneRemoteBridge();
  try {
    const config = await bridge.start();
    assert.ok(config.urls.length, 'LAN controller URL available');
    const html = await fetch(config.urls[0]).then(r => r.text());
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const elements = new Map(), intervals = [], posts = [];
    function target() {
      const listeners = new Map();
      return {
        style:{}, textContent:'', disabled:false,
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
        async fire(type, event = {}) { for (const fn of listeners.get(type) || []) await fn(event); },
        querySelector() { return {style:{}}; },
        setPointerCapture() {},
        getBoundingClientRect() { return {left:0,top:0,width:200,height:200}; }
      };
    }
    const document = Object.assign(target(), {hidden:false, getElementById(id) {
      if (!elements.has(id)) elements.set(id, target()); return elements.get(id);
    }});
    const window = Object.assign(target(), {isSecureContext:true, DeviceOrientationEvent:{}});
    let previews = 0;
    const context = {
      document, window, DeviceOrientationEvent:window.DeviceOrientationEvent, AbortController,
      URL:{createObjectURL:()=>'blob:preview',revokeObjectURL(){}},
      setInterval(fn, delay) { intervals.push({fn,delay}); }, setTimeout, clearTimeout,
      async fetch(url, options) {
        if (url.startsWith('/input')) posts.push(JSON.parse(options.body));
        else previews++;
        return {ok:true,status:200,blob:async()=>({size:20})};
      }
    };
    vm.runInNewContext(script, context);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    await settle();
    const frame = intervals.find(x=>x.delay===50);
    assert.ok(frame, 'preview polling starts without a browser ReferenceError');
    await frame.fn();
    assert.equal(previews, 2);
    const tick = intervals.find(x=>x.delay===33).fn;
    await elements.get('upBtn').fire('pointerdown',{pointerId:1});
    tick(); await settle(); assert.equal(posts.at(-1).height,1);
    await elements.get('upBtn').fire('lostpointercapture',{pointerId:1});
    tick(); await settle(); assert.equal(posts.at(-1).height,0);
    await elements.get('movePad').fire('pointerdown',{pointerId:2,clientX:172,clientY:100});
    tick(); await settle(); assert.equal(posts.at(-1).moveX,1);
    await window.fire('blur');
    tick(); await settle(); assert.equal(posts.at(-1).moveX,0);
    await elements.get('motionBtn').fire('click');
    await window.fire('deviceorientation',{alpha:null,beta:null,gamma:null});
    tick(); await settle(); assert.equal(posts.at(-1).motionActive,false);
    await window.fire('deviceorientation',{alpha:30,beta:70,gamma:10});
    tick(); await settle(); assert.equal(posts.at(-1).motionActive,true);
    await elements.get('motionBtn').fire('click');
    await window.fire('deviceorientation',{alpha:50,beta:70,gamma:10});
    tick(); await settle(); assert.equal(posts.at(-1).motionActive,false, 'stopped sensors must not reactivate');
    window.isSecureContext = false;
    await elements.get('motionBtn').fire('click');
    tick(); await settle(); assert.match(elements.get('status').textContent,/Physical Camera/);
  } finally { bridge.stop(); }
});
