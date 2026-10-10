import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:[new URL('../../web/lib/protocol.ts',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,platform:'node',format:'esm',write:false});
const {exactMoney,millimetres,short}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
test('financial formatting preserves balances beyond Number precision and exact signs',()=>{
  assert.equal(exactMoney(9007199254740993123456n),'9,007,199,254,740,993.123456');
  assert.equal(exactMoney(-175_000_000n),'−175');
  assert.equal(exactMoney(0n),'0');
  assert.equal(exactMoney(undefined),'—');
});
test('rainfall thresholds retain millimetre precision and readable Unicode',()=>{
  assert.equal(millimetres(50001n),'50.001');
  assert.equal(millimetres(50000n),'50');
  assert.equal(millimetres(49990n),'49.99');
  assert.equal(short('0x1234567890abcdef1234567890abcdef12345678'),'0x1234…5678');
});
