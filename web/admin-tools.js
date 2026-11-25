const shortcut='9090889';
const format=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
const amountRules={luck:{min:0,max:500,step:1},coins:{min:1,max:Number.MAX_SAFE_INTEGER,step:1},
 gems:{min:0,max:Math.floor(Number.MAX_SAFE_INTEGER/10),step:.1}};

export function setupAdminTools({canOpen,loadWallet,run}){
 const panel=document.getElementById('adminTools');
 if(!panel)return;
 const status=document.getElementById('adminToolsStatus');
 const adjustment=document.getElementById('adminAdjustment'),reset=document.getElementById('adminReset');
 const amount=adjustment.elements.amount,action=adjustment.elements.adjustment;
 const buttons=panel.querySelectorAll('button[type="submit"]');
 let digits='',lastKey=0,busy=false;

 function showBalances(wallet){
  for(const entry of panel.querySelectorAll('[data-admin-balance]')){
   const field=entry.dataset.adminBalance;
   entry.textContent=format.format(wallet[field]||0)+(field==='luck'?'%':'');
  }
 }
 function showStatus(message,error=false){status.textContent=message;status.dataset.error=String(error);}
 function setBusy(value){busy=value;for(const button of buttons)button.disabled=value;}
 function amountLimits(){
  const field=action.value.split(':')[0],rules=amountRules[field];
  Object.assign(amount,rules,{inputMode:field==='gems'?'decimal':'numeric'});
  amount.value='';
 }
 action.addEventListener('change',amountLimits);
 panel.querySelector('[data-close-admin]').addEventListener('click',()=>panel.close());
 window.addEventListener('keydown',async event=>{
  if(!canOpen()||event.repeat||event.ctrlKey||event.metaKey||event.altKey||
    event.target.closest?.('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]'))return;
  if(!/^\d$/.test(event.key)){digits='';return;}
  if(performance.now()-lastKey>1500)digits='';
  lastKey=performance.now();
  digits=(digits+event.key).slice(-shortcut.length);
  if(digits!==shortcut)return;
  digits='';
  showStatus('');
  panel.showModal();
  setBusy(true);
  try{showBalances(await loadWallet());}
  catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 });
 adjustment.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  const [field,mode]=action.value.split(':');
  setBusy(true);
  try{
   const {wallet}=await run('admin.adjust',{field,mode,amount:amount.valueAsNumber});
   showBalances(wallet);
   amount.value='';
   showStatus('Saved.');
  }catch(error){showStatus(error.message,true);}
  finally{setBusy(false);}
 });
 reset.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  setBusy(true);
  try{
   await run('admin.reset',{confirmation:reset.elements.confirmation.value});
   location.reload();
  }catch(error){showStatus(error.message,true);setBusy(false);}
 });
}
