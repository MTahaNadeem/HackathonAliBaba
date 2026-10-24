'use strict';
const APP_ORIGIN='https://coursecompassai.vercel.app';
let sequence=Promise.resolve();
const storageReady = (chrome.storage?.session?.setAccessLevel
  ? chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{})
  : (chrome.storage?.local?.setAccessLevel
    ? chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{})
    : Promise.resolve()));
chrome.runtime.onInstalled.addListener(()=>{chrome.action.setBadgeBackgroundColor({color:'#22c55e'});});
async function auth(input){
 const response=await fetch(`${APP_ORIGIN}/api/extension/auth`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok){const error=new Error(data.error||'Account service unavailable.');error.status=response.status;throw error;}return data;
}
async function saveSession(data){const session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at,userId:data.user.id,email:data.user.email};await chrome.storage.local.set({compassSession:session});return session;}
async function sessionToken(force=false){
 let {compassSession:session}=await chrome.storage.local.get('compassSession');if(!session)throw new Error('Sign in to your CourseCompass account first.');
 if(force||!session.expires_at||session.expires_at*1000<Date.now()+60000){try{session=await saveSession(await auth({action:'refresh',refresh_token:session.refresh_token}));}catch(error){if(error.status===401)await chrome.storage.local.remove('compassSession');throw error;} return session;}
 return session;
}
async function handle(message){
 await storageReady;
 if(message.action==='login'){const s=await saveSession(await auth({action:'login',email:message.email,password:message.password}));return {email:s.email,userId:s.userId};}
 if(message.action==='logout'){const{compassSession:s}=await chrome.storage.local.get('compassSession');if(s)await auth({action:'logout',access_token:s.access_token,refresh_token:s.refresh_token});await chrome.storage.local.remove('compassSession');return {signedOut:true};}
 if(message.action==='session'){const stored=await chrome.storage.local.get('compassSession');if(!stored.compassSession)return null;const s=await sessionToken();return {email:s.email,userId:s.userId};}
 if(message.action==='api'){
  if(!/^\/api\/extension\/(profile|analyses)(\?id=[a-f0-9-]{36})?$/.test(message.path)||!['GET','POST','PUT','PATCH','DELETE'].includes(message.method||'GET'))throw new Error('Unsupported extension operation.');
  let s=await sessionToken();const call=()=>fetch(APP_ORIGIN+message.path,{method:message.method||'GET',headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:message.body?JSON.stringify(message.body):undefined,signal:AbortSignal.timeout(30000)});
  let response=await call();if(response.status===401){s=await sessionToken(true);response=await call();}
  const data=await response.json();if(!response.ok){const error=new Error(data.error||'The account request failed. Please retry.');error.status=response.status;if(response.status===401)await chrome.storage.local.remove('compassSession');throw error;}return data;
 }
 throw new Error('Unsupported operation.');
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 const popupUrl=chrome.runtime.getURL('popup.html');
 if(sender.id!==chrome.runtime.id||!sender.url||sender.url.split('?')[0].split('#')[0]!==popupUrl)return;
 sequence=sequence.catch(()=>{}).then(()=>handle(message)).then(data=>sendResponse({ok:true,data}),error=>sendResponse({ok:false,error:error.message||'Network request failed. Please retry.',status:error.status}));return true;
});
