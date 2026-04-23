const EM=process.env.EGP_EMAIL;
const PW=process.env.EGP_PASSWORD;
const TG_TOK=process.env.TG_BOT_TOKEN;
const TG_ID=process.env.TG_CHAT_ID;
const GH_TOK=process.env.GH_TOKEN;
const GH_REPO=“puffsdad/egp-monitor”;
const BASE=“https://eastgrinsteadpadel-gb.matchpoint.com.es”;
const DID=“179a23c38a4ac2d4f9e68e15c0ef5b0f4773c7980f20eec16d1f874e6469f453”;
const GUID=“eastgrinsteadpadel”;
const VID=“2”;
function log(m){console.log(”[”+new Date().toISOString()+”] “+m);}
function getDates(){var days=[];for(var i=0;i<14;i++){var d=new Date();d.setDate(d.getDate()+i);days.push(String(d.getDate()).padStart(2,“0”)+”/”+String(d.getMonth()+1).padStart(2,“0”)+”/”+d.getFullYear());}return days;}
function fmtDate(fecha){var p=fecha.split(”/”);var d=new Date(p[2],p[1]-1,p[0]);var dn=[“Sunday”,“Monday”,“Tuesday”,“Wednesday”,“Thursday”,“Friday”,“Saturday”];var mn=[“Jan”,“Feb”,“Mar”,“Apr”,“May”,“Jun”,“Jul”,“Aug”,“Sep”,“Oct”,“Nov”,“Dec”];return dn[d.getDay()]+” “+p[0]+” “+mn[d.getMonth()];}
function isoToDmy(iso){var p=iso.split(”-”);return p[2]+”/”+p[1]+”/”+p[0];}
async function post(path,body,tok){var h={“Content-Type”:“application/json”,“Accept”:“application/json”,“selectedvenueid”:VID,“userlang”:“en-GB”,“User-Agent”:“EGPadel/95 Darwin/25.3.0”,“Cache-Control”:“no-cache”};if(tok)h[“userToken”]=tok;var r=await fetch(BASE+path,{method:“POST”,headers:h,body:JSON.stringify(body)});return r.json();}
async function getAlertIDs(){try{var r=await fetch(“https://api.github.com/repos/”+GH_REPO+”/actions/variables/ALERT_IDS”,{headers:{“Authorization”:“token “+GH_TOK,“Accept”:“application/vnd.github.v3+json”}});var j=await r.json();return JSON.parse(j.value||”[]”);}catch(e){return[];}}
async function getWatchDates(){try{var r=await fetch(“https://api.github.com/repos/”+GH_REPO+”/actions/variables/WATCH_DATES”,{headers:{“Authorization”:“token “+GH_TOK,“Accept”:“application/vnd.github.v3+json”}});var j=await r.json();return JSON.parse(j.value||”[]”);}catch(e){return[];}}
async function tg(msg){if(!TG_TOK)return;var ids=[TG_ID];var extra=await getAlertIDs();extra.forEach(function(id){if(id&&!ids.includes(id))ids.push(id);});log(“Sending to “+ids.length+” recipients…”);for(var i=0;i<ids.length;i++){if(!ids[i])continue;try{var r=await fetch(“https://api.telegram.org/bot”+TG_TOK+”/sendMessage”,{method:“POST”,headers:{“Content-Type”:“application/json”},body:JSON.stringify({chat_id:ids[i],text:msg})});var j=await r.json();if(j.ok)log(“TG sent to “+ids[i]);else log(“TG err: “+JSON.stringify(j));}catch(e){log(“TG err: “+e.message);}}}
async function ghGet(n){try{var r=await fetch(“https://api.github.com/repos/”+GH_REPO+”/actions/variables/”+n,{headers:{“Authorization”:“token “+GH_TOK,“Accept”:“application/vnd.github.v3+json”}});var j=await r.json();return j.value||””;}catch(e){return “”;}}
async function ghSet(n,val){try{await fetch(“https://api.github.com/repos/”+GH_REPO+”/actions/variables/”+n,{method:“PATCH”,headers:{“Authorization”:“token “+GH_TOK,“Accept”:“application/vnd.github.v3+json”,“Content-Type”:“application/json”},body:JSON.stringify({name:n,value:val})});}catch(e){log(“ghSet err: “+e.message);}}
async function login(){var r=await post(”/services/mobi/appservices/v1/cuenta.svc/LoginWithDeviceIdAndAppGUID”,{password:PW,APPGUID:GUID,deviceID:DID,deviceOS:“iphone”,deviceOSVersion:“26.3.1”,user:EM});if(!r||!r.Autentificado){log(“Login failed”);return null;}return r.UserState;}
async function check(utok){var dates=getDates();var found=[];for(var i=0;i<dates.length;i++){var fecha=dates[i];var cr=await post(”/services/mobi/appservices/v1/reservas.svc/ObtenerCuadroReservas2”,{tipo:“cuadroreservas”,cuadro:“4”,fecha:fecha},utok);if(!cr||!cr.Correcto)continue;var grupos=(cr.Respuesta||{}).Grupos||[];var slots=[];grupos.forEach(function(g,gi){var cn=“Court “+(gi+1);(g.Entradas||[]).forEach(function(e){if(e.Reservado===false&&e.Pasado===false){slots.push({court:cn,time:e.Hora_Inicio+” - “+e.Hora_Fin,date:fecha});}});});if(slots.length>0)found.push({date:fecha,slots:slots});}return found;}
async function main(){
log(“Logging in…”);
var utok=await login();
if(!utok){await tg(“EGP Monitor: Login failed”);process.exit(1);}
log(“Checking courts…”);
var res=await check(utok);
var key=JSON.stringify(res);
var last=await ghGet(“LAST_RESULT”);
if(key!==last){
await ghSet(“LAST_RESULT”,key);
if(res.length>0){
var msg=“Padel Court Available!\n\nEast Grinstead Padel\n\n”;
res.forEach(function(entry){msg+=fmtDate(entry.date)+”\n”;entry.slots.forEach(function(s,i){msg+=(i+1)+”. “+s.court+” “+s.time+”\n”;});msg+=”\n”;});
msg+=“Book: “+BASE+”/EastGrinsteadPadel/HomeEastGrinsteadPadel.aspx”;
await tg(msg);
}
log(“Results updated.”);
}else{
log(“No change.”);
}
var watchDates=await getWatchDates();
if(watchDates.length>0){
log(“Checking “+watchDates.length+” watch dates…”);
var watchMsg=””;
watchDates.forEach(function(iso){
var dmy=isoToDmy(iso);
var entry=res.find(function(e){return e.date===dmy;});
if(entry&&entry.slots.length>0){
watchMsg+=”\n”+fmtDate(dmy)+”\n”;
entry.slots.forEach(function(s,i){watchMsg+=(i+1)+”. “+s.court+” “+s.time+”\n”;});
}
});
if(watchMsg){
var alert=“PRIORITY ALERT!\n\nCourt available on your watched date!\n\nEast Grinstead Padel\n”+watchMsg+”\nBook: “+BASE+”/EastGrinsteadPadel/HomeEastGrinsteadPadel.aspx”;
await tg(alert);
log(“Watch date alert sent!”);
}else{
log(“No slots on watch dates.”);
}
}
log(“Done.”);
}
main().catch(function(err){log(“Fatal: “+err.message);process.exit(1);});