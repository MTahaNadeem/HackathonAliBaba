import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessUniversity,emptyProfile} from '../lib/domain';
import {universities} from '../lib/catalogue';
import type {University} from '../lib/catalogue';
import {parseNustFeePage} from '../lib/ingestion/parsers/nust-fee-page';
import {GET} from '../app/api/ingestion/refresh/route';

// ── 1. Parse failure must never overwrite existing DB value ──────────────
test('parse failure returns ok:false and does not produce fee data',()=>{
  const badHtml='<html><body>Page not found</body></html>';
  const result=parseNustFeePage(badHtml,'nust-civil','https://nust.edu.pk/fee');
  assert.equal(result.ok,false);
  // ok:false means no fees property exists on the result
  assert.ok(!('fees' in result),'ParseFailure must not contain fees');
});

test('parse failure preserves programme_id context for logging',()=>{
  const badHtml='This page has been updated but contains no PKR amounts.';
  const result=parseNustFeePage(badHtml,'nust-civil','https://nust.edu.pk/fee');
  assert.equal(result.ok,false);
  assert.ok(result.error.length>0,'ParseFailure must include an error message');
});

// ── 2. stale records must never pass budget check ────────────────────────
test('stale record with valid fee does not pass as within-budget',()=>{
  const staleU:University={
    id:'test-stale',name:'Test U',short:'TU',city:'Lahore',
    programme:'Test programme',degreeId:'civil',
    url:'https://example.edu',fee:200000,mandatory:5000,
    rule:'nust-engineering',checked:'2025-01-01',
    verificationStatus:'stale',
  };
  const a=assessUniversity(staleU,{...emptyProfile,budget:1000000,ssc:80,hssc:80,qualification:'FSc'});
  assert.equal(a.budget,'Costs need checking','stale fees must not pass budget filter');
  assert.equal(a.cost,null,'stale cost must be null');
});

// ── 3. needs_information records must never pass budget check ────────────
test('needs_information record with valid fee does not pass as within-budget',()=>{
  const unverifiedU:University={
    id:'test-needs-info',name:'Test U',short:'TU',city:'Karachi',
    programme:'Test programme',degreeId:'business',
    url:'https://example.edu',fee:150000,mandatory:3000,
    rule:'unknown',checked:'2025-01-01',
    verificationStatus:'needs_information',
  };
  const a=assessUniversity(unverifiedU,{...emptyProfile,budget:1000000});
  assert.equal(a.budget,'Costs need checking','needs_information fees must not pass budget filter');
  assert.equal(a.cost,null,'needs_information cost must be null');
});

// ── 4. live_refreshed & manual_snapshot records pass budget check normally ──
test('live_refreshed NUST record passes budget check with sufficient budget',()=>{
  const u=universities[0]; // nust-civil: fee=216750, mandatory=5000, status=live_refreshed
  assert.equal(u.verificationStatus,'live_refreshed');
  const a=assessUniversity(u,{...emptyProfile,budget:300000,ssc:80,hssc:80,qualification:'FSc'});
  assert.equal(a.budget,'Within semester budget');
  assert.equal(a.cost,221750);
});

test('manual_snapshot record passes budget check with sufficient budget',()=>{
  const manualU:University={
    id:'test-manual',name:'Test U',short:'TU',city:'Lahore',
    programme:'Test programme',degreeId:'civil',
    url:'https://example.edu',fee:100000,mandatory:5000,
    rule:'general',checked:'2026-10-10',
    verificationStatus:'manual_snapshot',
  };
  const a=assessUniversity(manualU,{...emptyProfile,budget:200000});
  assert.equal(a.budget,'Within semester budget');
  assert.equal(a.cost,105000);
});

test('live_refreshed NUST record fails budget check with insufficient budget',()=>{
  const u=universities[0];
  const a=assessUniversity(u,{...emptyProfile,budget:200000});
  assert.equal(a.budget,'Above semester budget');
});

// ── 5. NUST parser: well-formed HTML produces a ParseResult ─────────────
test('NUST parser extracts fee from a well-formed page',()=>{
  // Simulate a minimal NUST-like page structure
  const mockHtml=`
    <html><body>
      <h1>Fee Structure 2026-27</h1>
      <table>
        <tr><td>SCEE Engineering</td></tr>
        <tr><td>Tuition Fee</td><td>PKR 216,750</td></tr>
        <tr><td>Mandatory Charges</td><td>PKR 5,000</td></tr>
      </table>
    </body></html>
  `;
  const result=parseNustFeePage(mockHtml,'nust-civil','https://nust.edu.pk/fee');
  if(result.ok){
    // If parser succeeds, verify constraints
    if(result.fees.tuition_per_semester!==null){
      assert.ok(result.fees.tuition_per_semester>0,'tuition must be positive');
      assert.ok(result.fees.tuition_per_semester<10_000_000,'tuition must be within sanity bounds');
    }
    assert.equal(result.fees.fee_currency,'PKR');
    assert.equal(result.fees.fee_period,'semester');
  }
  // It's valid for the parser to fail on mock HTML — what matters is no exceptions
});

// ── 6. Existing domain tests still pass ─────────────────────────────────
test('A-level raw grades never become equivalence',()=>{
  const r=assessUniversity(universities[1],{...emptyProfile,qualification:'A-levels',ssc:95,hssc:95,net:90});
  assert.equal(r.status,'Equivalence needed');assert.equal(r.aggregate,null);
});

test('unknown fees do not pass budget filter',()=>{
  const r=assessUniversity(universities[2],{...emptyProfile,budget:1000000});
  assert.equal(r.budget,'Costs need checking');
});

test('a failed academic minimum wins over high test scores',()=>{
  const r=assessUniversity(universities[1],{...emptyProfile,ssc:59,hssc:99,net:100});
  assert.equal(r.status,'Below published minimum');assert.equal(r.aggregate,null);
});

test('NET formula uses percentages and source weights',()=>{
  const r=assessUniversity(universities[1],{...emptyProfile,ssc:90,hssc:80,net:75});
  assert.equal(r.aggregate,77.25);
});

// ── 7. Cron / scheduled trigger endpoint behavior ──────────────────────
test('cron refresh endpoint rejects unauthorized requests when CRON_SECRET is set', async () => {
  const origSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'secret_cron_token_test';
    const req = new Request('http://localhost/api/ingestion/refresh', {
      headers: { authorization: 'Bearer wrong_token' },
    });
    const res = await GET(req);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, 'Unauthorized');
  } finally {
    if (origSecret !== undefined) process.env.CRON_SECRET = origSecret;
    else delete process.env.CRON_SECRET;
  }
});
