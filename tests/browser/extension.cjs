/* eslint-disable typescript/no-require-imports -- Optional environment-provided Playwright resolves through CommonJS NODE_PATH. */
/* Chromium popup UI test. Chrome APIs and account responses are test fixtures.
 * The real MV3 worker is exercised separately in extension-integration.test.ts.
 * Managed Chromium here blocks unpacked extension installation.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext();
 const extension=path.resolve('courseai-compass-extension');
 const id='11111111-1111-4111-8111-111111111111';
 let session=null;let opened='';let analyses=0;
 const profile={skills:['JavaScript'],manualSkills:['JavaScript'],learnedSkills:['React'],inProgressSkills:['TypeScript'],inferredSkills:[],plans:[],profile:{skills:['JavaScript']},plan:null};
 await context.exposeBinding('fixtureMessage',async(_,m)=>{
  if(m.action==='session')return {ok:true,data:session};
  if(m.action==='login'){
   if(m.password==='incorrect')return {ok:false,error:'Invalid credentials'};
   session={email:m.email,userId:'test-user'};return {ok:true,data:session};
  }
  if(m.action==='logout'){session=null;return {ok:true,data:{signedOut:true}};}
  if(m.path==='/api/extension/profile')return {ok:true,data:profile};
  if(m.path==='/api/extension/analyses'&&m.method==='POST'){
   analyses++;assert.ok(m.body.bodyText.includes('React'));return {ok:true,data:{id,detectedSkills:['React','TypeScript'],matchedSkills:['React'],missingSkills:['TypeScript'],matchPercent:50,skillCoverage:50,overallJobMatch:null,method:'Fixture coverage; experience needs review.',serverLearnedSkills:['React']}};
  }
  return {ok:true,data:{analyses:[]}};
 });
 await context.exposeBinding('fixtureOpen',(_,url)=>{opened=url;});
 await context.addInitScript(()=>{
  const store={};window.chrome={runtime:{sendMessage:m=>window.fixtureMessage(m)},storage:{local:{get:async k=>({[k]:store[k]}),set:async value=>Object.assign(store,value)}},tabs:{query:async()=>[{id:1,url:'https://example.invalid/job',title:'React Developer'}],create:async({url})=>window.fixtureOpen(url)}};
 });
 await context.route('http://compass.test/**',route=>{
  const filename=path.basename(new URL(route.request().url()).pathname)||'popup.html';
  return route.fulfill({contentType:filename.endsWith('.js')?'application/javascript':filename.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(extension,filename))});
 });
 let page=await context.newPage();await page.goto('http://compass.test/popup.html');
 await page.locator('#navProfile').click();await page.locator('#loginEmail').fill('test@example.invalid');await page.locator('#loginPassword').fill('incorrect');await page.locator('#btnLogin').click();await page.locator('#loginError').filter({hasText:'Invalid credentials'}).waitFor();
 await page.locator('#loginPassword').fill('correct-test-password');await page.locator('#btnLogin').click();await page.locator('#loggedInSection').waitFor({state:'visible'});assert.equal(await page.locator('#loginPassword').inputValue(),'');
 await page.close();page=await context.newPage();await page.goto('http://compass.test/popup.html');await page.locator('#navProfile').click();await page.locator('#loggedInSection').waitFor({state:'visible'});assert.ok((await page.locator('#learnedSkillChips').textContent()).includes('React'));
 await page.locator('#navAnalyze').click();await page.locator('details summary').click();await page.locator('#manualJobText').fill('React and TypeScript are required for this frontend developer role.');await page.locator('#manualAnalyze').click();await page.locator('#resultsState').waitFor({state:'visible'});assert.equal(await page.locator('#scoreNumber').textContent(),'50%');assert.equal(analyses,1);
 await page.locator('#btnBuildPlan').click();await page.waitForTimeout(100);assert.equal(opened,`https://coursecompassai.vercel.app/?analysis=${id}#roadmap`);
 await page.locator('#navProfile').click();await page.locator('#btnLogout').click();await page.locator('#loginSection').waitFor({state:'visible'});assert.equal(session,null);
 // Exercise the actual extraction script against supported DOM fixtures.
 await page.setContent('<h1>React Developer</h1><div id="jobDescriptionText"><p>React and TypeScript are required. '+ 'Build accessible interfaces and collaborate with the product team. '.repeat(5)+'</p></div>');
 await page.evaluate(()=>{chrome.runtime.onMessage={addListener:fn=>{window.extractListener=fn;}};});
 await page.addScriptTag({path:path.join(extension,'content.js')});
 const extracted=await page.evaluate(()=>new Promise(resolve=>window.extractListener({action:'EXTRACT_JOB_DATA'},{},resolve)));
 assert.equal(extracted.success,true);assert.ok(extracted.data.bodyText.includes('TypeScript'));
 await page.setContent('<main>Unrelated search results '+ 'JavaScript '.repeat(40)+'</main>');
 const missing=await page.evaluate(()=>new Promise(resolve=>window.extractListener({action:'EXTRACT_JOB_DATA'},{},resolve)));assert.equal(missing.success,false);
 console.log('PASS: Chromium popup with mocked Chrome/account APIs: invalid/valid login, reopen, profile, manual analysis, UUID handoff, logout; actual extractor on Indeed-shaped and unsupported DOM fixtures.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
