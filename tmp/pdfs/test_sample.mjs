import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const base="http://127.0.0.1:8098/api";
async function req(path,body) {
 const response=await fetch(base+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json();assert.ok(response.ok,JSON.stringify({path,status:response.status,error:data.error}));return data;
}
let p=await req("/projects",{name:"PDF manual validation",client:"Synthetic client",description:"Isolated selectable-PDF fixture"});
const file=readFileSync("output/pdf/ScopeSathi-Demo-Client-Brief.pdf");
const form=new FormData();form.append("file",new Blob([file],{type:"application/pdf"}),"client-brief.pdf");
const response=await fetch(base+"/projects/"+p.id+"/document",{method:"POST",body:form});
const uploaded=await response.json();assert.equal(response.status,200,JSON.stringify(uploaded));
const text=uploaded.text;
const extracted=await req("/projects/"+p.id+"/extract",{brief:text});
const requirements=[];
for(let i=1;i<=7;i++){
 const start=text.indexOf("R"+i+".");assert.ok(start>=0);
 const end=i<7?text.indexOf("R"+(i+1)+".",start):text.indexOf("Acceptance and revision policy",start);
 assert.ok(end>start);
 const quote=text.slice(start,end).trim();
 requirements.push({id:"DEMO-"+i,text:quote.replace(/^R\d\.\s*/,"").replace(/\s+/g," "),quote});
}
p=await req("/projects/"+p.id+"/baseline",{revision:p.revision,brief:text,requirements});
assert.equal(p.versions.length,1);assert.equal(p.requirements.length,7);
p=await req("/projects/"+p.id+"/tasks",{revision:p.revision,title:"Build checkout",requirementIds:["DEMO-1"]});
p=await req("/projects/"+p.id+"/revision-policy",{revision:p.revision,includedRounds:1,definition:"Related requests count as one approved new-scope round."});
const message="Please allow guest checkout alongside email-and-password sign-in. Guest customers must receive an order-tracking link that expires after 24 hours. Please include a CSV export of the signed-in customer's own order history and remove CSV exports from the excluded work.";
p=await req("/projects/"+p.id+"/requests",{revision:p.revision,title:"Launch review",source:"Synthetic client message",text:message});
const r=p.requests[0];assert.match(r.analysis.summary,/No AI analysis/);
const findings=[
 {id:"TEST-1",kind:"modification",title:"Guest checkout",requirementId:"DEMO-1",currentQuote:p.requirements[0].text,requestQuote:"Please allow guest checkout alongside email-and-password sign-in. Guest customers must receive an order-tracking link that expires after 24 hours.",proposedText:"Customers may sign in with email/password or check out as guests. Guest customers receive an order-tracking link expiring after 24 hours.",reason:"Client confirmed additional checkout path.",questions:[],taskIds:[]},
 {id:"TEST-2",kind:"modification",title:"CSV boundary",requirementId:"DEMO-7",currentQuote:p.requirements[6].text,requestQuote:"remove CSV exports from the excluded work",proposedText:"Native mobile applications and inventory integrations are excluded.",reason:"Client explicitly amended excluded work.",questions:[],taskIds:[]},
 {id:"TEST-3",kind:"addition",title:"CSV export",requirementId:"",currentQuote:"",requestQuote:"Please include a CSV export of the signed-in customer's own order history",proposedText:"Signed-in customers may export their own order history as CSV.",reason:"Client requested new scope.",questions:[],taskIds:[]}
];
p=await req("/projects/"+p.id+"/requests/"+r.id+"/proposal",{revision:p.revision,findings});
p=await req("/projects/"+p.id+"/requests/"+r.id+"/decision",{revision:p.revision,decision:"approved",note:"Synthetic client confirmed all three reviewed findings."});
assert.equal(p.versions.length,2);assert.equal(p.tasks[0].status,"needs_review");assert.equal(p.requirements.length,8);
assert.equal(p.requests[0].analysis.findings.length,3);
const reopened=await req("/projects/"+p.id);
assert.equal(reopened.versions.length,2);
console.log(JSON.stringify({upload:200,textCharacters:text.length,draftEntries:extracted.requirements.length,reviewedRequirements:7,findingsApproved:3,baselineVersion:2,taskStatus:p.tasks[0].status,storage:"isolated demo",ai:"manual - no model call",reload:true}));
