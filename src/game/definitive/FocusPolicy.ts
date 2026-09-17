/**
 * Desktop focus may move to browser chrome or another monitor during play.
 * Clear held controls on blur, but pause only when the page is actually hidden.
 */
export function bindFocusPolicy(signal:AbortSignal,clear:()=>void,pause:()=>void):void{
  window.addEventListener('blur',clear,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();},{signal});
}
