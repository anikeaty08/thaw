// Shared by the root layout (server) and IntroCurtain (client), so it lives outside any "use client" module.
export const INTRO_SESSION_KEY = "thaw-intro";

// Runs before first paint (inlined in <head>). The curtain only plays on a fresh load of the landing
// page, once per browser session, and never for people who ask for reduced motion. CSS keys off the
// two flags it sets: `motion-ok` (hero starts hidden, GSAP reveals it) and `data-intro="play"`.
export const motionInitScript = `(function(){try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("motion-ok");var seen=null;try{seen=sessionStorage.getItem("${INTRO_SESSION_KEY}")}catch(e){}if(location.pathname==="/"&&!seen)d.dataset.intro="play";}catch(e){}})();`;
