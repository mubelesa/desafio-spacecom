import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePosition} from '../src/process-dataset.js';
const row=(timestamp,latitude)=>'1;;'+timestamp+';'+latitude+';0;false;';
test('conversão direta mantém o conversor nativo nas bordas e em números longos',()=>{
 for(const latitude of ['0','-0','90','-90','0.00001','-0.00001','89.99999','0.123456789012345','0.1234567890123456789012345','00000000000000001.00000']){
  assert.ok(Object.is(parsePosition(row('"2024-01-01 00:00:00"',latitude)).lat,Number(latitude)),latitude);
 }
 for(const latitude of ['','.1','1.','+1','1e0',' 1','1..0','--1'])assert.throws(()=>parsePosition(row('"2024-01-01 00:00:00"',latitude)),/inválidos/);
});
test('reutilização do timestamp preserva o formato e não aceita campos malformados',()=>{
 const previous='2024-01-01 00:00:00';
 for(const timestamp of ['"2024-01-01 00:00:00"','2024-01-01 00:00:00'])assert.equal(parsePosition(row(timestamp,'0'),previous).timestamp,previous);
 assert.equal(parsePosition(row('"2024-01-01 00:00:05"','0'),previous).timestamp,'2024-01-01 00:00:05');
 for(const timestamp of ['"2024-01-01 00:00:00','2024-01-01 00:00:00"','"2024-01-01 00:00:00x"'])assert.throws(()=>parsePosition(row(timestamp,'0'),previous),/inválidos/);
});
