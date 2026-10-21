if(new URLSearchParams(location.search).has('embed')){
  const thumbId=new URLSearchParams(location.search).get('thumbAsset');let frames=0,captured=false;
  globalThis.assetStudioCapture=canvas=>{if(globalThis.ASSET_PUBLIC||!thumbId||captured||++frames<16)return;captured=true;const small=document.createElement('canvas');small.width=320;small.height=240;small.getContext('2d').drawImage(canvas,0,0,320,240);small.toBlob(async blob=>{if(!blob)return;try{const response=await fetch('/api/thumbnails/'+encodeURIComponent(thumbId),{method:'POST',headers:{'Content-Type':'image/png'},body:blob});if(response.ok)parent.postMessage({type:'studio-thumbnail',id:thumbId,...await response.json()},location.origin);}catch{}},'image/png');};
  const style=document.createElement('style');style.textContent=`.topbar,body.viewer>header{display:none!important}#panel{display:none!important}.viewer #view-status{font-size:11px;bottom:8px;left:8px;right:8px;max-height:48px;overflow:auto}.viewer #viewport:not([hidden])~#view-status{display:none}.viewer #image-preview{inset:3%;width:94%;height:94%}footer{font-size:10px}.viewer .native{inset:12% 8%;font-size:14px}.viewer .native h1{font-size:24px}`;document.head.append(style);
  addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='studio-action')return;
    const action=event.data.action;if(['fit','rotate','quality','pilot','tour','light'].includes(action))document.getElementById(action)?.click();
    if(['vista','district','street'].includes(action))document.querySelector(`[data-view="${action}"]`)?.click();
  });
}
