function t(t,e,i,o){var s,n=arguments.length,r=n<3?e:null===o?o=Object.getOwnPropertyDescriptor(e,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(t,e,i,o);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(r=(n<3?s(r):n>3?s(e,i,r):s(e,i))||r);return n>3&&r&&Object.defineProperty(e,i,r),r}"function"==typeof SuppressedError&&SuppressedError;
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const e=globalThis,i=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,o=Symbol(),s=new WeakMap;let n=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==o)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(i&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=s.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&s.set(e,t))}return t}toString(){return this.cssText}};const r=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,o)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[o+1],t[0]);return new n(i,t,o)},a=i?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new n("string"==typeof t?t:t+"",void 0,o))(e)})(t):t,{is:l,defineProperty:h,getOwnPropertyDescriptor:c,getOwnPropertyNames:d,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,f=globalThis,g=f.trustedTypes,m=g?g.emptyScript:"",v=f.reactiveElementPolyfillSupport,y=(t,e)=>t,$={toAttribute(t,e){switch(e){case Boolean:t=t?m:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!l(t,e),w={attribute:!0,type:String,converter:$,reflect:!1,useDefault:!1,hasChanged:b};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),f.litPropertyMetadata??=new WeakMap;let _=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=w){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),o=this.getPropertyDescriptor(t,i,e);void 0!==o&&h(this.prototype,t,o)}}static getPropertyDescriptor(t,e,i){const{get:o,set:s}=c(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:o,set(e){const n=o?.call(this);s?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??w}static _$Ei(){if(this.hasOwnProperty(y("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(y("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(y("properties"))){const t=this.properties,e=[...d(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,o)=>{if(i)t.adoptedStyleSheets=o.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const i of o){const o=document.createElement("style"),s=e.litNonce;void 0!==s&&o.setAttribute("nonce",s),o.textContent=i.cssText,t.appendChild(o)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),o=this.constructor._$Eu(t,i);if(void 0!==o&&!0===i.reflect){const s=(void 0!==i.converter?.toAttribute?i.converter:$).toAttribute(e,i.type);this._$Em=t,null==s?this.removeAttribute(o):this.setAttribute(o,s),this._$Em=null}}_$AK(t,e){const i=this.constructor,o=i._$Eh.get(t);if(void 0!==o&&this._$Em!==o){const t=i.getPropertyOptions(o),s="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:$;this._$Em=o;const n=s.fromAttribute(e,t.type);this[o]=n??this._$Ej?.get(o)??n,this._$Em=null}}requestUpdate(t,e,i,o=!1,s){if(void 0!==t){const n=this.constructor;if(!1===o&&(s=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(s,e)||i.useDefault&&i.reflect&&s===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:o,wrapped:s},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==s||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===o&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,o=this[e];!0!==t||this._$AL.has(e)||void 0===o||this.C(e,void 0,i,o)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};_.elementStyles=[],_.shadowRootOptions={mode:"open"},_[y("elementProperties")]=new Map,_[y("finalized")]=new Map,v?.({ReactiveElement:_}),(f.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const z=globalThis,A=t=>t,x=z.trustedTypes,T=x?x.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",k=`lit$${Math.random().toFixed(9).slice(2)}$`,S="?"+k,E=`<${S}>`,P=document,M=()=>P.createComment(""),O=t=>null===t||"object"!=typeof t&&"function"!=typeof t,L=Array.isArray,U="[ \t\n\f\r]",N=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,I=/-->/g,D=/>/g,H=RegExp(`>|${U}(?:([^\\s"'>=/]+)(${U}*=${U}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),B=/'/g,R=/"/g,F=/^(?:script|style|textarea|title)$/i,j=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),V=j(1),Z=j(2),W=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),G=new WeakMap,K=P.createTreeWalker(P,129);function Y(t,e){if(!L(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==T?T.createHTML(e):e}const J=(t,e)=>{const i=t.length-1,o=[];let s,n=2===e?"<svg>":3===e?"<math>":"",r=N;for(let e=0;e<i;e++){const i=t[e];let a,l,h=-1,c=0;for(;c<i.length&&(r.lastIndex=c,l=r.exec(i),null!==l);)c=r.lastIndex,r===N?"!--"===l[1]?r=I:void 0!==l[1]?r=D:void 0!==l[2]?(F.test(l[2])&&(s=RegExp("</"+l[2],"g")),r=H):void 0!==l[3]&&(r=H):r===H?">"===l[0]?(r=s??N,h=-1):void 0===l[1]?h=-2:(h=r.lastIndex-l[2].length,a=l[1],r=void 0===l[3]?H:'"'===l[3]?R:B):r===R||r===B?r=H:r===I||r===D?r=N:(r=H,s=void 0);const d=r===H&&t[e+1].startsWith("/>")?" ":"";n+=r===N?i+E:h>=0?(o.push(a),i.slice(0,h)+C+i.slice(h)+k+d):i+k+(-2===h?e:d)}return[Y(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),o]};class X{constructor({strings:t,_$litType$:e},i){let o;this.parts=[];let s=0,n=0;const r=t.length-1,a=this.parts,[l,h]=J(t,e);if(this.el=X.createElement(l,i),K.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(o=K.nextNode())&&a.length<r;){if(1===o.nodeType){if(o.hasAttributes())for(const t of o.getAttributeNames())if(t.endsWith(C)){const e=h[n++],i=o.getAttribute(t).split(k),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:s,name:r[2],strings:i,ctor:"."===r[1]?ot:"?"===r[1]?st:"@"===r[1]?nt:it}),o.removeAttribute(t)}else t.startsWith(k)&&(a.push({type:6,index:s}),o.removeAttribute(t));if(F.test(o.tagName)){const t=o.textContent.split(k),e=t.length-1;if(e>0){o.textContent=x?x.emptyScript:"";for(let i=0;i<e;i++)o.append(t[i],M()),K.nextNode(),a.push({type:2,index:++s});o.append(t[e],M())}}}else if(8===o.nodeType)if(o.data===S)a.push({type:2,index:s});else{let t=-1;for(;-1!==(t=o.data.indexOf(k,t+1));)a.push({type:7,index:s}),t+=k.length-1}s++}}static createElement(t,e){const i=P.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,o){if(e===W)return e;let s=void 0!==o?i._$Co?.[o]:i._$Cl;const n=O(e)?void 0:e._$litDirective$;return s?.constructor!==n&&(s?._$AO?.(!1),void 0===n?s=void 0:(s=new n(t),s._$AT(t,i,o)),void 0!==o?(i._$Co??=[])[o]=s:i._$Cl=s),void 0!==s&&(e=Q(t,s._$AS(t,e.values),s,o)),e}class tt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,o=(t?.creationScope??P).importNode(e,!0);K.currentNode=o;let s=K.nextNode(),n=0,r=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new et(s,s.nextSibling,this,t):1===a.type?e=new a.ctor(s,a.name,a.strings,this,t):6===a.type&&(e=new rt(s,this,t)),this._$AV.push(e),a=i[++r]}n!==a?.index&&(s=K.nextNode(),n++)}return K.currentNode=P,o}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class et{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,o){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),O(t)?t===q||null==t||""===t?(this._$AH!==q&&this._$AR(),this._$AH=q):t!==this._$AH&&t!==W&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>L(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==q&&O(this._$AH)?this._$AA.nextSibling.data=t:this.T(P.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,o="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=X.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===o)this._$AH.p(e);else{const t=new tt(o,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=G.get(t.strings);return void 0===e&&G.set(t.strings,e=new X(t)),e}k(t){L(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,o=0;for(const s of t)o===e.length?e.push(i=new et(this.O(M()),this.O(M()),this,this.options)):i=e[o],i._$AI(s),o++;o<e.length&&(this._$AR(i&&i._$AB.nextSibling,o),e.length=o)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=A(t).nextSibling;A(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class it{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,o,s){this.type=1,this._$AH=q,this._$AN=void 0,this.element=t,this.name=e,this._$AM=o,this.options=s,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=q}_$AI(t,e=this,i,o){const s=this.strings;let n=!1;if(void 0===s)t=Q(this,t,e,0),n=!O(t)||t!==this._$AH&&t!==W,n&&(this._$AH=t);else{const o=t;let r,a;for(t=s[0],r=0;r<s.length-1;r++)a=Q(this,o[i+r],e,r),a===W&&(a=this._$AH[r]),n||=!O(a)||a!==this._$AH[r],a===q?t=q:t!==q&&(t+=(a??"")+s[r+1]),this._$AH[r]=a}n&&!o&&this.j(t)}j(t){t===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class ot extends it{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===q?void 0:t}}class st extends it{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==q)}}class nt extends it{constructor(t,e,i,o,s){super(t,e,i,o,s),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??q)===W)return;const i=this._$AH,o=t===q&&i!==q||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,s=t!==q&&(i===q||o);o&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const at=z.litHtmlPolyfillSupport;at?.(X,et),(z.litHtmlVersions??=[]).push("3.3.2");const lt=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class ht extends _{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const o=i?.renderBefore??e;let s=o._$litPart$;if(void 0===s){const t=i?.renderBefore??null;o._$litPart$=s=new et(e.insertBefore(M(),t),t,void 0,i??{})}return s._$AI(t),s})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return W}}ht._$litElement$=!0,ht.finalized=!0,lt.litElementHydrateSupport?.({LitElement:ht});const ct=lt.litElementPolyfillSupport;ct?.({LitElement:ht}),(lt.litElementVersions??=[]).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const dt=t=>(e,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},pt={attribute:!0,type:String,converter:$,reflect:!1,hasChanged:b},ut=(t=pt,e,i)=>{const{kind:o,metadata:s}=i;let n=globalThis.litPropertyMetadata.get(s);if(void 0===n&&globalThis.litPropertyMetadata.set(s,n=new Map),"setter"===o&&((t=Object.create(t)).wrapped=!0),n.set(i.name,t),"accessor"===o){const{name:o}=i;return{set(i){const s=e.get.call(this);e.set.call(this,i),this.requestUpdate(o,s,t,!0,i)},init(e){return void 0!==e&&this.C(o,void 0,t,e),e}}}if("setter"===o){const{name:o}=i;return function(i){const s=this[o];e.call(this,i),this.requestUpdate(o,s,t,!0,i)}}throw Error("Unsupported decorator location: "+o)};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function ft(t){return(e,i)=>"object"==typeof i?ut(t,e,i):((t,e,i)=>{const o=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),o?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function gt(t){return ft({...t,state:!0,attribute:!1})}const mt=Math.PI/180,vt=180/Math.PI,yt=Date.UTC(2e3,0,1,12,0,0),$t=t=>((t+180)%360+360)%360-180;function bt(t){const e=(t.getTime()-yt)/864e5,i=280.46+.9856474*e,o=(357.528+.9856003*e)*mt,s=(i+1.915*Math.sin(o)+.02*Math.sin(2*o))*mt,n=(23.439-4e-7*e)*mt,r=Math.asin(Math.sin(n)*Math.sin(s))*vt,a=Math.atan2(Math.cos(n)*Math.sin(s),Math.cos(s))*vt,l=$t(i-a),h=t.getUTCHours()+t.getUTCMinutes()/60+t.getUTCSeconds()/3600+t.getUTCMilliseconds()/36e5;return{lat:r,lon:$t(-15*(h-12)-l)}}const wt=Math.PI/180,_t=180/Math.PI,zt=1e-4;function At(t,e={}){const i=e.stepDeg??1,o=(e.centerLon??180)-180;let s=t.lat;Math.abs(s)<zt&&(s=s>=0?zt:-1e-4);const n=Math.tan(s*wt),r=[];for(let e=0;e<=360;e+=i){const i=(o+e-t.lon)*wt,s=Math.atan(-Math.cos(i)/n)*_t;r.push([e,s])}return r}function xt(t,e,i){const o=[];for(const[s,n]of t){const t=s/360*e,r=(90-n)/180*i;o.push(`${t.toFixed(2)},${r.toFixed(2)}`)}return o.join(" ")}const Tt=44;let Ct=null,kt=null;function St(t,e,i,o=180){if(t.length<3)return"";const s=o-180,n=[];let r=null,a=1/0,l=-1/0;for(const[o,h]of t){let t=((o-s)%360+360)%360;if(null!==r){for(;t-r>180;)t-=360;for(;t-r<-180;)t+=360}r=t;const c=t/360*e,d=(90-h)/180*i;n.push([c,d]),c<a&&(a=c),c>l&&(l=c)}const h=n,c=t=>{let e="";for(let i=0;i<h.length;i++){const[o,s]=h[i];e+=`${0===i?"M":"L"}${(o+t).toFixed(1)},${s.toFixed(1)}`}return e+"Z"};let d=c(0);return l>e&&(d+=c(-e)),a<0&&(d+=c(e)),d}function Et(t){const e=t.split("/");return e.length<2?t:e[e.length-1].replace(/_/g," ")}const Pt=new Map;function Mt(t,e,i){const o=function(t,e){const i=`${t}|${Array.isArray(e)?e.join(","):""}`;let o=Pt.get(i);return o||(o={time:new Intl.DateTimeFormat(e,{timeZone:t,hour:"numeric",minute:"2-digit",second:"2-digit"}),date:new Intl.DateTimeFormat(e,{timeZone:t,weekday:"short",month:"short",day:"numeric"}),zoneName:new Intl.DateTimeFormat("en-US",{timeZone:t,hour:"numeric",timeZoneName:"long"}),offset:new Intl.DateTimeFormat("en-US",{timeZone:t,timeZoneName:"longOffset"})},Pt.set(i,o)),o}(e,i),s=(t,e)=>t.find(t=>t.type===e)?.value??"",n=o.zoneName.formatToParts(t),r=o.offset.formatToParts(t);return{time:o.time.format(t),date:o.date.format(t),name:s(n,"timeZoneName"),offset:s(r,"timeZoneName").replace(/^GMT/,"UTC")}}let Ot=null,Lt=null;function Ut(t,e){if(e&&/^UTC[+−\-]\d/.test(e))return e;const i=t>=0?"+":"-",o=Math.abs(t);return`UTC${i}${String(Math.trunc(o)).padStart(2,"0")}:${String(Math.round(60*(o-Math.trunc(o)))).padStart(2,"0")}`}function Nt(t){const e=t.trim();return e.length<=80?e:e.slice(0,77)+"…"}var It;const Dt=2048,Ht=1024;let Bt=class extends ht{constructor(){super(...arguments),this.displayNow=new Date,this.mapNow=new Date,this.tzPolygons=null,this.tzIanaPolygons=null,this.tzPolygonsCenterLon=null,this.tzData=null,this.tzIanaData=null,this.hoveredIana=null,this.hoveredOffset=null,this.hoverPos=null,this.isCardVisible=!0,this.intersecting=!0,this.warnedFallback="",this.onIanaEnter=(t,e)=>{this.clearDismissTimer(),this.hoveredIana=e,this.updateHoverPos(t)},this.onIanaLeave=t=>{"touch"!==t.pointerType?(this.hoveredIana=null,this.hoveredOffset||(this.hoverPos=null)):this.scheduleTouchDismiss(()=>{this.hoveredIana=null,this.hoveredOffset||(this.hoverPos=null)})},this.onOffsetEnter=(t,e)=>{this.clearDismissTimer(),this.hoveredOffset=e,this.updateHoverPos(t)},this.onOffsetLeave=t=>{"touch"!==t.pointerType?(this.hoveredOffset=null,this.hoveredIana||(this.hoverPos=null)):this.scheduleTouchDismiss(()=>{this.hoveredOffset=null,this.hoveredIana||(this.hoverPos=null)})},this.onZoneMove=t=>{this.updateHoverPos(t)}}static{It=this}static{this.styles=r`
    :host {
      display: block;
      background: var(--ha-card-background, var(--card-background-color, #111));
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
      color: var(--primary-text-color, #fff);
      --geo-tz-bg: rgba(8, 14, 28, 0.85);
      --geo-tz-hour: #d8e2f0;
      --geo-tz-noon: #ffd866;
      --geo-tz-mid: #6ab0ff;
      --geo-tz-tick: rgba(255, 255, 255, 0.35);
      --geo-tz-line: rgba(255, 255, 255, 0.18);
      --geo-tz-line-width: 1;
      --geo-home-marker: var(--accent-color, #ff7a3d);
      --geo-day-brightness: 1.15;
      --geo-night-contrast: 1;
      --geo-twilight-color: #463701;
      --geo-twilight-opacity: 0.26;
    }
    .day-image {
      filter: brightness(var(--geo-day-brightness));
    }
    .night-image {
      filter: contrast(var(--geo-night-contrast));
    }
    /* Warm sunrise/sunset glow stroked along the terminator great
       circle. Blurred + screen-blended so it brightens the day side
       without dimming the night side. */
    .twilight-glow {
      fill: none;
      stroke: var(--geo-twilight-color);
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: var(--geo-twilight-opacity);
      mix-blend-mode: screen;
      pointer-events: none;
    }
    .frame {
      position: relative;
      width: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .readout {
      position: absolute;
      bottom: 10px;
      left: 14px;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      line-height: 1.15;
    }
    .local-time {
      font-size: clamp(1rem, 2.4vw, 1.7rem);
      font-weight: 500;
    }
    .utc-time {
      font-size: clamp(0.75rem, 1.4vw, 1rem);
      color: #ffd866;
      opacity: 0.92;
    }
    .date {
      position: absolute;
      bottom: 10px;
      right: 14px;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      font-size: clamp(0.85rem, 1.6vw, 1.15rem);
    }

    /* Hour band */
    .tz-bg {
      fill: var(--geo-tz-bg);
    }
    .tz-hour {
      fill: var(--geo-tz-hour);
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      font-weight: 500;
      font-size: 26px;
    }
    .tz-hour.noon {
      fill: var(--geo-tz-noon);
      font-weight: 700;
    }
    .tz-hour.mid {
      fill: var(--geo-tz-mid);
      font-weight: 600;
    }
    .tz-tick {
      stroke: var(--geo-tz-tick);
      stroke-width: 1;
    }

    /* Time-zone boundary overlay — visible offset boundaries with a
       transparent fill so the polygon interior is hit-testable.
       Renders BELOW the IANA layer; IANA captures hover where it
       has coverage (land), and we fall back to this layer's hover
       in the gaps (open ocean, polar strips). */
    .tz-region {
      fill: rgba(255, 255, 255, 0);
      stroke: var(--geo-tz-line);
      stroke-width: var(--geo-tz-line-width);
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: visiblePainted;
      cursor: default;
      transition: fill 120ms ease;
    }
    .tz-region:hover {
      fill: rgba(255, 255, 255, 0.05);
    }
    /* Invisible IANA hit-test layer — tagged with each region's IANA
       tzid so the popup can ask Intl.DateTimeFormat for DST-aware
       local time. Faint tint on hover gives visual feedback that
       the user is over an interactive region. */
    .tz-iana-region {
      fill: rgba(255, 255, 255, 0);
      stroke: rgba(255, 255, 255, 0);
      stroke-width: 0;
      pointer-events: visiblePainted;
      cursor: default;
      transition: fill 120ms ease, stroke 120ms ease, stroke-width 120ms ease;
    }
    .tz-iana-region:hover,
    .tz-iana-region.is-active {
      fill: rgba(255, 255, 255, 0.08);
      stroke: rgba(255, 255, 255, 0.65);
      stroke-width: 1.5;
    }
    /* Home marker — small filled dot at hass.config lat/lon. */
    .home-marker-dot {
      fill: var(--geo-home-marker);
      stroke: rgba(0, 0, 0, 0.6);
      stroke-width: 1.2;
      pointer-events: none;
    }
    .home-marker-halo {
      fill: var(--geo-home-marker);
      opacity: 0.25;
      pointer-events: none;
    }
    /* Custom popup. Positioned via inline transform from JS so it
       follows the cursor; ignores its own pointer events so it never
       steals hover from the underlying region. */
    .tz-popup {
      position: absolute;
      left: 0;
      top: 0;
      pointer-events: none;
      background: rgba(8, 14, 28, 0.92);
      color: var(--primary-text-color, #fff);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
      max-width: 280px;
      z-index: 5;
    }
    .tz-popup-time {
      font-size: 1.15rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .tz-popup-date {
      font-size: 0.78rem;
      opacity: 0.78;
      margin-top: 1px;
    }
    .tz-popup-name {
      font-size: 0.9rem;
      color: #ffd866;
      font-weight: 600;
      margin-top: 2px;
    }
    .tz-popup-city {
      font-size: 0.82rem;
      opacity: 0.92;
      margin-top: 1px;
    }
    .tz-popup-offset {
      font-size: 0.72rem;
      opacity: 0.62;
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }
    .tz-popup-places {
      font-size: 0.72rem;
      opacity: 0.62;
      margin-top: 3px;
      line-height: 1.3;
    }
  `}setConfig(t){if(!t)throw new Error("geo-clock-card: missing config");const e=t.imageryBase??new URL(".",import.meta.url).href,i=function(t){if(null==t)return;const e=t instanceof Date?t:new Date(t);return Number.isFinite(e.getTime())?e:void 0}(t.now);this.config={twilightDegrees:Rt(t.twilightDegrees??8,1,18),updateInterval:Rt(t.updateInterval??1,1,600),showUTC:t.showUTC??!0,showTimezoneBand:t.showTimezoneBand??!0,showTimezoneBoundaries:t.showTimezoneBoundaries??!0,showTimezonePopup:t.showTimezonePopup??!0,timezoneLineColor:Ft(t.timezoneLineColor)??"rgba(255, 255, 255, 0.18)",dayBrightness:Rt(t.dayBrightness??1.15,0,5),nightContrast:Rt(t.nightContrast??1,0,5),twilightColor:Ft(t.twilightColor)??"#463701",twilightOpacity:Rt(t.twilightOpacity??.26,0,1),imageryBase:e.endsWith("/")?e:e+"/",center:t.center??"sun",centerLongitude:"number"==typeof t.centerLongitude?Rt(t.centerLongitude,-180,180):void 0,centerEntity:t.centerEntity,showHomeMarker:t.showHomeMarker??!1,frozenNow:i};const o=i??new Date;this.displayNow=o,this.mapNow=o,this.tzPolygons=null,this.tzIanaPolygons=null,this.tzPolygonsCenterLon=null,this.restartTimer(),this.maybeLoadTimezones(),this.maybeLoadIanaTimezones()}connectedCallback(){if(super.connectedCallback(),!this.config?.frozenNow){const t=new Date;this.displayNow=t,this.mapNow=t}this.attachVisibilityObservers(),this.restartTimer(),this.maybeLoadTimezones(),this.maybeLoadIanaTimezones()}disconnectedCallback(){super.disconnectedCallback(),this.stopTimer(),this.clearDismissTimer(),this.detachVisibilityObservers()}attachVisibilityObservers(){"undefined"==typeof IntersectionObserver||this.intersectionObserver||(this.intersectionObserver=new IntersectionObserver(t=>{const e=t[t.length-1];this.intersecting=!e||e.isIntersecting,this.recomputeVisibility()},{threshold:0}),this.intersectionObserver.observe(this)),"undefined"==typeof document||this.onTabVisibility||(this.onTabVisibility=()=>this.recomputeVisibility(),document.addEventListener("visibilitychange",this.onTabVisibility))}detachVisibilityObservers(){this.intersectionObserver?.disconnect(),this.intersectionObserver=void 0,this.onTabVisibility&&"undefined"!=typeof document&&document.removeEventListener("visibilitychange",this.onTabVisibility),this.onTabVisibility=void 0}recomputeVisibility(){const t="undefined"==typeof document||"hidden"!==document.visibilityState,e=this.intersecting&&t;if(e!==this.isCardVisible){if(this.isCardVisible=e,e){const t=new Date;this.displayNow=t,this.mapNow=t}this.restartTimer()}}restartTimer(){if(this.stopTimer(),!this.config||!this.isConnected)return;if(this.config.frozenNow)return;const t=this.isCardVisible?1e3*this.config.updateInterval:18e5;this.timer=setInterval(()=>this.tick(),t)}tick(){const t=new Date;this.displayNow=t,t.getTime()-this.mapNow.getTime()>=10546.875&&(this.mapNow=t)}stopTimer(){void 0!==this.timer&&(clearInterval(this.timer),this.timer=void 0)}maybeLoadTimezones(){if(!this.config?.showTimezoneBoundaries||null!==this.tzData)return;(function(t){return Ot&&Lt===t||(Lt=t,Ot=fetch(t).then(t=>{if(!t.ok)throw new Error(`tz fetch failed: ${t.status}`);return t.json()})),Ot})(this.config.imageryBase+"timezones.json").then(t=>{this.tzData=t,this.requestUpdate()}).catch(t=>{console.warn("geo-clock-card: timezone overlay failed to load:",t)})}maybeLoadIanaTimezones(){if(!this.config?.showTimezoneBoundaries||null!==this.tzIanaData)return;(function(t){return Ct&&kt===t||(kt=t,Ct=fetch(t).then(t=>{if(!t.ok)throw new Error(`iana tz fetch failed: ${t.status}`);return t.json()})),Ct})(this.config.imageryBase+"timezones-iana.json").then(t=>{this.tzIanaData=t,this.requestUpdate()}).catch(t=>{console.warn("geo-clock-card: IANA timezone overlay failed to load:",t)})}static{this.FALLBACK_CENTER_LON=0}resolveCenterLon(t){if(!this.config)return bt(t).lon;switch(this.config.center){case"home":{const t=this.hass?.config?.longitude;return"number"==typeof t?t:(this.warnFallback("home","hass.config.longitude is not set; falling back to Greenwich (0°)"),It.FALLBACK_CENTER_LON)}case"longitude":return"number"==typeof this.config.centerLongitude?this.config.centerLongitude:(this.warnFallback("longitude","centerLongitude not set; falling back to Greenwich (0°)"),It.FALLBACK_CENTER_LON);case"entity":{const t=this.config.centerEntity,e=t?this.hass?.states?.[t]:void 0,i=e?.attributes?.longitude;return"number"==typeof i?i:(this.warnFallback("entity",t?`entity '${t}' has no numeric longitude attribute; falling back to Greenwich (0°)`:"centerEntity not set; falling back to Greenwich (0°)"),It.FALLBACK_CENTER_LON)}default:return bt(t).lon}}warnFallback(t,e){const i=`${t}|${e}`;this.warnedFallback!==i&&(this.warnedFallback=i,console.warn(`geo-clock-card: center mode '${t}' — ${e}`))}resolveHomeLatLon(){const t=this.hass?.config?.latitude,e=this.hass?.config?.longitude;return"number"!=typeof t||"number"!=typeof e?null:{lat:t,lon:e}}render(){if(!this.config)return V``;const t=this.config.frozenNow??this.mapNow,e=this.config.frozenNow??this.displayNow,i=this.resolveCenterLon(t),o=bt(t),s=At(o,{centerLon:i}),n=function(t,e={}){const i=At(t,e);let o=t.lat;Math.abs(o)<zt&&(o=o>=0?zt:-1e-4);const s=o>0?-90:90;return[...i,[360,s],[0,s]]}(o,{centerLon:i}),r=xt(n,Dt,Ht),a=xt(s,Dt,Ht),l=2*this.config.twilightDegrees*Ht/180,h=Math.max(.5,l/8),c=Math.max(4,.55*l),d=Math.max(1,l/5),p=this.config.imageryBase+function(t){const e=t.getUTCDate();let i,o=t.getUTCMonth()+1;return e<8?i="start":e<23?i="mid":(i="start",o=12===o?1:o+1),`blue-marble-${String(o).padStart(2,"0")}-${i}-2048.jpg`}(t),u=this.config.imageryBase+"black-marble-2048.jpg",f=(-i/360*Dt%Dt+Dt)%Dt;if(this.config.showTimezoneBoundaries){const t=this.tzPolygonsCenterLon!==i;this.tzData&&(t||null===this.tzPolygons)&&(this.tzPolygons=function(t,e,i,o=180){const s=[];for(const n of t.features){const t="Polygon"===n.geometry.type?[n.geometry.coordinates]:n.geometry.coordinates;let r="";for(const s of t)0!==s.length&&(r+=St(s[0],e,i,o));r&&s.push({offset:n.properties.zone,offsetLabel:Ut(n.properties.zone,n.properties.time_zone),name:n.properties.name??null,places:Nt(n.properties.places??""),d:r})}return s}(this.tzData,Dt,Ht,i)),this.tzIanaData&&(t||null===this.tzIanaPolygons)&&(this.tzIanaPolygons=function(t){const e=t=>{let e=1/0,i=1/0,o=-1/0,s=-1/0;const n=/[ML]([\d.\-]+),([\d.\-]+)/g;let r;for(;r=n.exec(t);){const t=parseFloat(r[1]),n=parseFloat(r[2]);t<e&&(e=t),t>o&&(o=t),n<i&&(i=n),n>s&&(s=n)}return isFinite(e)?(o-e)*(s-i):0};return[...t].sort((t,i)=>e(i.d)-e(t.d))}(function(t,e,i,o=180){const s=[];for(const n of t.features){const t="Polygon"===n.geometry.type?[n.geometry.coordinates]:n.geometry.coordinates;let r="";for(const s of t)0!==s.length&&(r+=St(s[0],e,i,o));r&&s.push({tzid:n.properties.tzid,cityLabel:Et(n.properties.tzid),d:r})}return s}(this.tzIanaData,Dt,Ht,i))),this.tzPolygonsCenterLon=i}const g=function(t){return t.toLocaleTimeString(void 0,{hour:"numeric",minute:"2-digit",second:"2-digit",timeZoneName:"short"})}(e),m=function(t){const e=String(t.getUTCHours()).padStart(2,"0"),i=String(t.getUTCMinutes()).padStart(2,"0"),o=String(t.getUTCSeconds()).padStart(2,"0");return`${e}:${i}:${o} UTC`}(e),v=function(t){return t.toLocaleDateString(void 0,{weekday:"short",month:"short",day:"numeric",year:"numeric"})}(e),y=this.config.showTimezoneBand,$=y?-44:0,b=y?1068:Ht,w=`aspect-ratio: 2048 / ${b}; --geo-day-brightness: ${this.config.dayBrightness}; --geo-night-contrast: ${this.config.nightContrast}; --geo-twilight-color: ${this.config.twilightColor}; --geo-twilight-opacity: ${this.config.twilightOpacity}; --geo-tz-line: ${this.config.timezoneLineColor};`;return V`
      <div class="frame" style="${w}">
        <svg
          viewBox="0 ${$} ${Dt} ${b}"
          preserveAspectRatio="xMidYMid slice"
          aria-label="World map with current day/night terminator"
        >
          <defs>
            <filter
              id="feather"
              x="-5%"
              y="-5%"
              width="110%"
              height="110%"
              filterUnits="objectBoundingBox"
            >
              <feGaussianBlur stdDeviation="${h}" />
            </filter>
            <mask
              id="night-mask"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="${Dt}"
              height="${Ht}"
            >
              <rect width="${Dt}" height="${Ht}" fill="black" />
              <polygon points="${r}" fill="white" filter="url(#feather)" />
            </mask>
            <filter
              id="twilight-blur"
              x="-3%"
              y="-3%"
              width="106%"
              height="106%"
              filterUnits="objectBoundingBox"
            >
              <feGaussianBlur stdDeviation="${d}" />
            </filter>
          </defs>

          <image class="day-image" href="${p}"
                 x="${f-Dt}" y="0"
                 width="${Dt}" height="${Ht}"
                 preserveAspectRatio="none"/>
          <image class="day-image" href="${p}"
                 x="${f}" y="0"
                 width="${Dt}" height="${Ht}"
                 preserveAspectRatio="none"/>
          <image class="night-image" href="${u}"
                 x="${f-Dt}" y="0"
                 width="${Dt}" height="${Ht}"
                 preserveAspectRatio="none"
                 mask="url(#night-mask)"/>
          <image class="night-image" href="${u}"
                 x="${f}" y="0"
                 width="${Dt}" height="${Ht}"
                 preserveAspectRatio="none"
                 mask="url(#night-mask)"/>

          <polyline class="twilight-glow"
                    points="${a}"
                    stroke-width="${c}"
                    filter="url(#twilight-blur)"/>

          ${this.tzPolygons&&this.config.showTimezoneBoundaries?this.tzPolygons.map(t=>Z`<path class="tz-region" d="${t.d}"
                                 @pointerenter=${e=>this.onOffsetEnter(e,t)}
                                 @pointermove=${this.onZoneMove}
                                 @pointerleave=${this.onOffsetLeave}/>`):""}
          ${this.tzIanaPolygons&&this.config.showTimezoneBoundaries?this.tzIanaPolygons.map(t=>Z`<path class="tz-iana-region${this.hoveredIana===t?" is-active":""}" d="${t.d}"
                                 @pointerenter=${e=>this.onIanaEnter(e,t)}
                                 @pointermove=${this.onZoneMove}
                                 @pointerleave=${this.onIanaLeave}/>`):""}

          ${this.config.showHomeMarker?this.renderHomeMarker(i):""}

          ${y?function(t,e,i=180){const o=function(t,e,i=180){const o=t.getUTCHours()+t.getUTCMinutes()/60+t.getUTCSeconds()/3600,s=e/24,n=i-180,r=[];for(let t=0;t<=24;t++){const e=n+15*t;let i=e/15;for(;i>12;)i-=24;for(;i<=-12;)i+=24;const a=((o+e/15)%24+24)%24|0;r.push({offset:i,realLon:e,centerX:t*s,hour12:(a+11)%12+1,isNoon:12===a,isMidnight:0===a})}return r}(t,e,i),s=e/24,n=[];for(let t=1;t<24;t++)n.push(t*s);return Z`
    <g class="tz-band">
      <rect class="tz-bg"
            x="0" y="${-44}"
            width="${e}" height="${Tt}"/>

      ${o.map(t=>Z`
        <text class="tz-hour${t.isNoon?" noon":""}${t.isMidnight?" mid":""}"
              x="${t.centerX}" y="${-21}"
              text-anchor="middle" dominant-baseline="central">${t.hour12}</text>`)}

      ${n.map(t=>Z`
        <line class="tz-tick"
              x1="${t}" y1="${0}"
              x2="${t}" y2="${12}"/>`)}
    </g>
  `}(t,Dt,i):""}
        </svg>
        <div class="readout">
          <div class="local-time">${g}</div>
          ${this.config.showUTC?V`<div class="utc-time">${m}</div>`:""}
        </div>
        <div class="date">${v}</div>
        ${this.renderPopup(e)}
      </div>
    `}getCardSize(){return 4}static async getConfigElement(){return await Promise.resolve().then(function(){return Zt}),document.createElement("geo-clock-card-editor")}static getStubConfig(){return{type:"custom:geo-clock-card",center:"sun"}}static{this.TOUCH_DISMISS_MS=2500}clearDismissTimer(){void 0!==this.dismissTimer&&(clearTimeout(this.dismissTimer),this.dismissTimer=void 0)}scheduleTouchDismiss(t){this.clearDismissTimer(),this.dismissTimer=setTimeout(()=>{this.dismissTimer=void 0,t()},It.TOUCH_DISMISS_MS)}updateHoverPos(t){const e=t.currentTarget.closest(".frame");if(!e)return;const i=e.getBoundingClientRect();this.hoverPos={x:t.clientX-i.left,y:t.clientY-i.top}}renderHomeMarker(t){const e=this.resolveHomeLatLon();if(!e)return"";const{x:i,y:o}=function(t,e,i,o,s=180){return{x:((e-(s-180))%360+360)%360/360*i,y:(90-t)/180*o}}(e.lat,e.lon,Dt,Ht,t);return Z`
      <circle class="home-marker-halo" cx="${i}" cy="${o}" r="22"/>
      <circle class="home-marker-dot"  cx="${i}" cy="${o}" r="7"/>
    `}renderPopup(t){if(!this.hoverPos)return V``;if(!1===this.config?.showTimezonePopup)return V``;const e=this.shadowRoot?.querySelector(".frame"),i=e?.clientWidth??1280,o=e?.clientHeight??720,s=this.hoverPos.x>.55*i,n=this.hoverPos.y>.5*o,r=s?-260:14,a=n?-14:14,l=n?" translateY(-100%)":"",h=`transform: translate(${this.hoverPos.x+r}px, ${this.hoverPos.y+a}px)${l};`;if(this.hoveredIana){const e=this.hoveredIana,i=Mt(t,e.tzid);return V`
        <div class="tz-popup" style=${h}>
          <div class="tz-popup-time">${i.time}</div>
          <div class="tz-popup-date">${i.date}</div>
          <div class="tz-popup-name">${i.name}</div>
          <div class="tz-popup-city">${e.cityLabel}</div>
          <div class="tz-popup-offset">${i.offset} · ${e.tzid}</div>
        </div>
      `}if(this.hoveredOffset){const e=this.hoveredOffset,i=function(t,e){const i=new Date(t.getTime()+36e5*e),o=new Intl.DateTimeFormat(void 0,{timeZone:"UTC",hour:"numeric",minute:"2-digit",second:"2-digit"}).format(i),s=new Intl.DateTimeFormat(void 0,{timeZone:"UTC",weekday:"short",month:"short",day:"numeric"}).format(i);return{time:o,date:s}}(t,e.offset);return V`
        <div class="tz-popup" style=${h}>
          <div class="tz-popup-time">${i.time}</div>
          <div class="tz-popup-date">${i.date}</div>
          ${e.name?V`<div class="tz-popup-name">${e.name}</div>`:""}
          <div class="tz-popup-offset">${e.offsetLabel}</div>
          ${e.places?V`<div class="tz-popup-places">${e.places}</div>`:""}
        </div>
      `}return V``}};function Rt(t,e,i){return Math.max(e,Math.min(i,t))}function Ft(t){if("string"!=typeof t)return;const e=t.trim();return/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(e)||/^(?:rgb|rgba|hsl|hsla)\([\d.,%\s/]+\)$/i.test(e)||/^[a-z]+$/i.test(e)?e:void 0}var jt;t([ft({attribute:!1})],Bt.prototype,"hass",void 0),t([gt()],Bt.prototype,"displayNow",void 0),t([gt()],Bt.prototype,"mapNow",void 0),t([gt()],Bt.prototype,"tzPolygons",void 0),t([gt()],Bt.prototype,"tzIanaPolygons",void 0),t([gt()],Bt.prototype,"hoveredIana",void 0),t([gt()],Bt.prototype,"hoveredOffset",void 0),t([gt()],Bt.prototype,"hoverPos",void 0),Bt=It=t([dt("geo-clock-card")],Bt),window.customCards=window.customCards||[],window.customCards.push({type:"geo-clock-card",name:"Geo Clock Card",description:"World map with a live day/night terminator (NASA Blue/Black Marble).",preview:!0});let Vt=class extends ht{static{jt=this}setConfig(t){console.debug("geo-clock-card editor: setConfig",t),this._config=t}static{this.styles=r`
    :host {
      display: block;
    }
    .section {
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .section + .section {
      border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .section-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--primary-text-color, #000);
      margin-bottom: 4px;
    }
    .help {
      font-size: 0.8rem;
      color: var(--secondary-text-color, #666);
      margin-top: -6px;
    }
    ha-textfield,
    ha-select,
    ha-entity-picker {
      width: 100%;
    }
    ha-entity-picker {
      display: block;
    }
    ha-formfield {
      display: block;
      padding: 4px 0;
    }
    .color-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .color-row label {
      flex: 1;
      font-size: 0.95rem;
      color: var(--primary-text-color);
    }
    .color-row input[type='color'] {
      width: 56px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      cursor: pointer;
      background: transparent;
    }
    /* Native select styled to match HA's input look. We use this for
       the center-mode dropdown because ha-select's selected event
       has been fragile across HA frontend versions. */
    .native-select {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .native-select label {
      font-size: 0.85rem;
      color: var(--secondary-text-color, #666);
    }
    .native-select select {
      width: 100%;
      padding: 12px 8px;
      font-size: 1rem;
      color: var(--primary-text-color, #000);
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      box-sizing: border-box;
    }
  `}fire(t,e){if(!this._config)return;const i={...this._config};void 0===e||""===e||null===e?delete i[t]:i[t]=e,console.debug("geo-clock-card editor: dispatch",t,"→",e,i),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}numField(t){return e=>{const i=e.target.value;this.fire(t,""===i?void 0:Number(i))}}strField(t){return e=>{const i=e.target.value;this.fire(t,i)}}toggle(t){return e=>{this.fire(t,e.target.checked)}}static{this.CENTER_MODES=["sun","home","longitude","entity"]}render(){if(!this._config)return V``;const t=this._config,e=t.center??"sun";return V`
      <div class="section">
        <div class="section-title">Map centering</div>
        <div class="native-select">
          <label for="geo-center-mode">Center on</label>
          <select
            id="geo-center-mode"
            .value=${e}
            @change=${t=>{const e=t.target.value;jt.CENTER_MODES.includes(e)&&this.fire("center",e)}}
          >
            <option value="sun" ?selected=${"sun"===e}>
              Sun (subsolar point — drifts with daylight)
            </option>
            <option value="home" ?selected=${"home"===e}>
              Home (Home Assistant location)
            </option>
            <option value="longitude" ?selected=${"longitude"===e}>
              Specific longitude
            </option>
            <option value="entity" ?selected=${"entity"===e}>
              Follow an entity
            </option>
          </select>
        </div>

        ${"longitude"===e?V`
              <ha-textfield
                label="Longitude (-180 to 180)"
                type="number"
                min="-180"
                max="180"
                step="0.1"
                .value=${null==t.centerLongitude?"":String(t.centerLongitude)}
                @input=${this.numField("centerLongitude")}
              ></ha-textfield>
            `:""}
        ${"entity"===e?V`
              <ha-entity-picker
                .hass=${this.hass}
                label="Entity to follow"
                .value=${t.centerEntity??""}
                .includeDomains=${["zone","person","device_tracker"]}
                .entityFilter=${t=>"number"==typeof t?.attributes?.longitude}
                allow-custom-entity
                @value-changed=${t=>this.fire("centerEntity",t.detail.value)}
              ></ha-entity-picker>
              <div class="help">
                Filtered to zone / person / device_tracker entities that
                currently expose a numeric <code>longitude</code> attribute.
              </div>
            `:""}

        <ha-formfield label="Show home marker on map">
          <ha-switch
            ?checked=${t.showHomeMarker??!1}
            @change=${this.toggle("showHomeMarker")}
          ></ha-switch>
        </ha-formfield>
      </div>

      <div class="section">
        <div class="section-title">Display</div>
        <ha-formfield label="Show UTC time">
          <ha-switch
            ?checked=${t.showUTC??!0}
            @change=${this.toggle("showUTC")}
          ></ha-switch>
        </ha-formfield>
        <ha-formfield label="Show hour-of-day band">
          <ha-switch
            ?checked=${t.showTimezoneBand??!0}
            @change=${this.toggle("showTimezoneBand")}
          ></ha-switch>
        </ha-formfield>
        <ha-formfield label="Show time-zone overlay">
          <ha-switch
            ?checked=${t.showTimezoneBoundaries??!0}
            @change=${this.toggle("showTimezoneBoundaries")}
          ></ha-switch>
        </ha-formfield>
        <ha-formfield label="Show hover popup (live time at the pointed-to zone)">
          <ha-switch
            ?checked=${t.showTimezonePopup??!0}
            @change=${this.toggle("showTimezonePopup")}
          ></ha-switch>
        </ha-formfield>
      </div>

      <div class="section">
        <div class="section-title">Update rate</div>
        <ha-textfield
          label="Clock tick (seconds, 1–600)"
          type="number"
          min="1"
          max="600"
          step="1"
          .value=${String(t.updateInterval??1)}
          @input=${this.numField("updateInterval")}
        ></ha-textfield>
        <div class="help">
          The map itself auto-throttles separately — it only re-renders
          when the subsolar point has shifted enough to be visible at 4K.
        </div>
      </div>

      <ha-expansion-panel
        outlined
        header="Advanced visual settings"
        secondary="Day brightness, night contrast, twilight glow, line color"
      >
        <div class="section panel-body">
          <ha-textfield
            label="Day brightness (0.5–2.0)"
            type="number"
            min="0.5"
            max="2"
            step="0.05"
            .value=${String(t.dayBrightness??1.15)}
            @input=${this.numField("dayBrightness")}
          ></ha-textfield>
          <ha-textfield
            label="Night contrast (0.5–3.0)"
            type="number"
            min="0.5"
            max="3"
            step="0.05"
            .value=${String(t.nightContrast??1)}
            @input=${this.numField("nightContrast")}
          ></ha-textfield>
          <ha-textfield
            label="Twilight band (1–18 sun-elevation degrees)"
            type="number"
            min="1"
            max="18"
            step="1"
            .value=${String(t.twilightDegrees??8)}
            @input=${this.numField("twilightDegrees")}
          ></ha-textfield>
          <div class="color-row">
            <label for="twilight-color">Twilight color</label>
            <input
              id="twilight-color"
              type="color"
              .value=${t.twilightColor??"#463701"}
              @input=${this.strField("twilightColor")}
            />
          </div>
          <ha-textfield
            label="Twilight opacity (0–1)"
            type="number"
            min="0"
            max="1"
            step="0.02"
            .value=${String(t.twilightOpacity??.26)}
            @input=${this.numField("twilightOpacity")}
          ></ha-textfield>
          <div class="color-row">
            <label for="tz-line-color">Time-zone line color</label>
            <input
              id="tz-line-color"
              type="color"
              .value=${this.tzLineColorAsHex(t.timezoneLineColor)}
              @input=${this.strField("timezoneLineColor")}
            />
          </div>
          <div class="help">
            For finer alpha control of the line color, set <code>timezoneLineColor</code>
            directly in YAML using an <code>rgba(…)</code> value.
          </div>
        </div>
      </ha-expansion-panel>
    `}tzLineColorAsHex(t){return t&&/^#[0-9a-f]{6,8}$/i.test(t)?t.slice(0,7):"#ffffff"}};t([ft({attribute:!1})],Vt.prototype,"hass",void 0),t([gt()],Vt.prototype,"_config",void 0),Vt=jt=t([dt("geo-clock-card-editor")],Vt);var Zt=Object.freeze({__proto__:null,get GeoClockCardEditor(){return Vt}});export{Bt as GeoClockCard};
//# sourceMappingURL=geo-clock-card.js.map
