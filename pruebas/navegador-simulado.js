const nodo = () => ({ innerHTML:'', textContent:'', value:'', dataset:{}, style:{},
  classList:{add(){},remove(){},toggle:()=>false,contains:()=>false},
  querySelector:()=>nodo(), querySelectorAll:()=>[], addEventListener(){},
  getBoundingClientRect:()=>({height:0,top:0,width:0}), closest:()=>nodo(),
  appendChild(){}, remove(){}, focus(){}, click(){}, scrollTo(){}, insertBefore(){},
  setAttribute(){}, getAttribute:()=>null, firstChild:null, children:[] });
globalThis.location = { hostname:'x', pathname:'/', search:'' };
globalThis.document = Object.assign(nodo(), {
  getElementById:()=>null, createElement:()=>nodo(), body:nodo(), head:nodo(), hidden:false });
globalThis.window = { addEventListener(){}, scrollTo(){}, scrollY:0, innerWidth:1400,
  matchMedia:()=>({matches:false,addEventListener(){}}), IntersectionObserver:class{observe(){}disconnect(){}} };
globalThis.IntersectionObserver = window.IntersectionObserver;
Object.defineProperty(globalThis,"navigator",{value:{clipboard:{writeText:async()=>{}}},configurable:true});
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
globalThis.supabase = { rpc: async()=>({data:[],error:null}),
  auth:{ getSession:async()=>({data:{session:null}}), onAuthStateChange(){},
         signInWithPassword:async()=>({error:null}), signOut:async()=>({}) } };
globalThis.createClient = () => globalThis.supabase;
